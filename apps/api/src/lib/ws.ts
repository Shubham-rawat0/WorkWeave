function normalizeConfiguredWsBaseUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error("Execution websocket URL is empty.");
    }
    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        const withProtocol = trimmed.startsWith("//")
            ? `ws:${trimmed}`
            : `ws://${trimmed.replace(/^\/+/, "")}`;
        parsed = new URL(withProtocol);
    }
    if (parsed.protocol === "http:") {
        parsed.protocol = "ws:";
    } else if (parsed.protocol === "https:") {
        parsed.protocol = "wss:";
    } else if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
        throw new Error(`Unsupported websocket protocol: ${parsed.protocol}`);
    }
    return parsed.toString().replace(/\/$/, "");
}

export function resolveExecutionStreamWsBaseUrlFromEnv(): string | undefined {
    const configured =
        process.env.NEXT_PUBLIC_EXECUTION_WS_URL?.trim() ||
        process.env.EXECUTION_WS_URL?.trim();
    if (!configured) {
        return undefined;
    }
    try {
        return normalizeConfiguredWsBaseUrl(configured);
    } catch (error) {
        console.warn(
            "[workflow.execute] Invalid EXECUTION_WS_URL/NEXT_PUBLIC_EXECUTION_WS_URL. Falling back to client defaults.",
            error,
        );
        return undefined;
    }
}

export function resolveExecutionStreamSigningSecret(): string {
    const secret =
        process.env.EXECUTION_STREAM_SIGNING_SECRET?.trim();
    if (!secret) {
        throw new Error(
            "Execution stream signing secret is required. Set BETTER_AUTH_SECRET or EXECUTION_STREAM_SIGNING_SECRET.",
        );
    }
    return secret;
}