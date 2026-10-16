import { parseTemplateWithMetadata } from "@WorkOrchestrator/shared/parser";
import { ssrfError, validateOutboundUrl } from "@WorkOrchestrator/shared/ssrf";
import {
    resolveCredentialByPlatform,
    resolveCredentials,
} from "../../engine/credentials";
import { NodeExecutionOutput, SlackNodeData } from "../../engine/types";
import { formatMessage } from "./formatMessage";

/**
 * Slack only issues incoming webhooks on these hosts, so anything else can be
 * rejected before a network request is even attempted.
 */
const SLACK_WEBHOOK_HOSTS = new Set([
    "hooks.slack.com",
    "hooks.slack-gov.com",
]);

/** Shortens a template so error messages stay readable. */
function previewTemplate(template: string, maxLength = 100): string {
    return template.length > maxLength
        ? `${template.slice(0, maxLength)}...`
        : template;
}

/**
 * Cleans a webhook URL that may have been pasted wrapped in Slack's `<...>`
 * auto-link markup or surrounded by quotes. Returns `undefined` for empty input.
 */
function normalizeSlackWebhookUrl(url: string | undefined): string | undefined {
    if (!url) {
        return undefined;
    }
    let normalized = String(url).trim();
    if (!normalized) {
        return undefined;
    }
    // Strip `<https://...>` link wrappers.
    if (normalized.startsWith("<") && normalized.endsWith(">")) {
        normalized = normalized.slice(1, -1).trim();
    }
    // Strip a matching pair of surrounding quotes.
    if (
        (normalized.startsWith('"') && normalized.endsWith('"')) ||
        (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
        normalized = normalized.slice(1, -1).trim();
    }
    return normalized || undefined;
}

/**
 * Validates that a URL is a usable Slack incoming webhook: HTTPS, one of
 * Slack's hosts, the default port, and no embedded userinfo.
 */
function isSlackWebhookUrl(url: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    return (
        parsed.protocol === "https:" &&
        SLACK_WEBHOOK_HOSTS.has(parsed.hostname.toLowerCase()) &&
        parsed.port === "" &&
        parsed.username === "" &&
        parsed.password === ""
    );
}

/**
 * Credential lookups that are safe to recover from by falling back to another
 * Slack credential for the same user (e.g. a stale credential id on the node).
 */
function isRecoverableCredentialResolutionError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }
    const message = error.message.toLowerCase();
    return (
        message.includes("not found or access denied") ||
        message.includes("please provide correct credentials") ||
        message.includes("is not a slack credential")
    );
}

/**
 * Resolves the webhook URL to POST to, in priority order:
 *   1. an explicit `credentialId` (falling back to the user's latest Slack
 *      credential when that id is stale),
 *   2. the URL stored directly on the node,
 *   3. `SLACK_WEBHOOK_URL` from the environment.
 * Throws when no usable URL can be found.
 */
async function resolveSlackWebhookUrl(
    data: SlackNodeData,
    ownerId: string,
): Promise<string> {
    let resolvedWebhookUrl: string | undefined;
    let credentialResolutionError: Error | undefined;

    const credentialId =
        typeof data.credentialId === "string" ? data.credentialId.trim() : "";

    if (credentialId.length > 0) {
        try {
            const { platform, keys } = await resolveCredentials(
                credentialId,
                ownerId,
            );
            // Refuse a credential id that belongs to a different provider.
            if (platform.toLowerCase() !== "slack") {
                throw new Error(
                    `Credential ${credentialId} is not a Slack credential`,
                );
            }
            resolvedWebhookUrl = normalizeSlackWebhookUrl(keys.webhookUrl);
        } catch (error) {
            if (!isRecoverableCredentialResolutionError(error)) {
                throw error;
            }
            credentialResolutionError =
                error instanceof Error
                    ? error
                    : new Error("Failed to resolve Slack credential");
            // Stale id: recover with the user's most recently updated Slack credential.
            const fallbackCredential = await resolveCredentialByPlatform(
                ownerId,
                "slack",
            );
            if (fallbackCredential) {
                resolvedWebhookUrl = normalizeSlackWebhookUrl(
                    fallbackCredential.keys.webhookUrl,
                );
            }
        }
    }

    // Node-level URL, then the environment default.
    if (!resolvedWebhookUrl) {
        resolvedWebhookUrl = normalizeSlackWebhookUrl(
            data.webhookUrl || process.env.SLACK_WEBHOOK_URL,
        );
    }

    if (!resolvedWebhookUrl) {
        if (credentialResolutionError) {
            throw new Error(
                `${credentialResolutionError.message}. This workflow likely has a stale Slack credential. Re-select the Slack credential on the node.`,
            );
        }
        throw new Error("Slack webhook URL not configured");
    }

    return resolvedWebhookUrl;
}

/**
 * Executes a Slack node: render the message template against upstream outputs,
 * resolve the webhook target, validate it against SSRF rules, then POST the
 * message. Returns a plain object shaped to fit `NodeExecutionOutput`.
 */
export async function executeSlackNode(
    data: SlackNodeData,
    runMetadata: Record<string, NodeExecutionOutput>,
    ownerId: string,
): Promise<NodeExecutionOutput> {
    const { message, channel } = data;

    // No template configured: nothing to send, and that is not an error.
    if (!message) {
        return {
            success: true,
            skipped: true,
            reason: "Node not configured - no message provided",
        };
    }

    // Substitute `{{path}}` placeholders using upstream node outputs.
    const parsed = parseTemplateWithMetadata(message, runMetadata);
    const parsedMessage = parsed.output;

    // The template rendered to nothing because its placeholders are unknown.
    if (!parsedMessage && parsed.missingVars?.length) {
        return {
            success: false,
            skipped: false,
            error:
                `Message template uses undefined variables: ${parsed.missingVars.join(", ")}. ` +
                `Original template: "${previewTemplate(message)}"`,
        };
    }

    // Empty for any other reason (blank template, or vars that resolved to "").
    if (!parsedMessage) {
        return {
            success: true,
            skipped: true,
            reason: "Node not configured - message is empty",
        };
    }

    // Unescape encoded newlines/quotes and collapse excess whitespace.
    const formattedMessage = formatMessage(parsedMessage);
    if (!formattedMessage) {
        return {
            success: true,
            skipped: true,
            reason: "Node not configured - message is empty after formatting",
        };
    }

    const resolvedWebhookUrl = await resolveSlackWebhookUrl(data, ownerId);
    if (!isSlackWebhookUrl(resolvedWebhookUrl)) {
        throw new Error("Invalid Slack webhook URL");
    }

    // Defense-in-depth: the host is already allow-listed, but still verify that
    // the resolved DNS/IP targets are not private addresses.
    try {
        await validateOutboundUrl(resolvedWebhookUrl);
    } catch (error) {
        if (error instanceof ssrfError) {
            throw new Error(`Blocked Slack webhook target: ${error.message}`);
        }
        throw error;
    }

    // Slack incoming webhooks accept a JSON body of `{ text, channel? }`.
    const payload: Record<string, string> = { text: formattedMessage };
    if (channel) {
        payload.channel = channel;
    }

    const response = await fetch(resolvedWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(
            `Failed to send Slack message: ${response.status} ${body}`,
        );
    }

    return {
        success: true,
        message: "Slack message sent",
        renderedMessage: formattedMessage,
    };
}
