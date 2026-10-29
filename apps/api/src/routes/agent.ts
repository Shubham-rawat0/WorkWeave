import { prisma, Prisma, type User } from "@WorkOrchestrator/prisma";
import { Hono } from "hono";
import { createRateLimiter } from "../middleware/rateLimit";
import { workflowAgentInputSchema } from "../schemas/agents";
import { zValidator } from "@hono/zod-validator";
import { validationHook } from "../lib/validator";
import { getAgentModel, isSupportedAgentPlatform } from "../utils/model";
import { agentWorkflowTools } from "../agents/tools";
import { HTTPException } from "hono/http-exception";
import { decryptJson } from "@WorkOrchestrator/shared/crypto";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { WORKFLOW_AGENT_SYSTEM_PROMPT } from "../agents/prompt";

function getLastUserPrompt(messages: readonly UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;

    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("\n")
      .trim();

    if (text) return text.slice(0, 500);
  }

  return "";
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const app = new Hono<{ Variables: { user: User } }>()
  .use("/*", createRateLimiter(60, 60_000))
  .post(
    "/chat",
    zValidator("json", workflowAgentInputSchema, validationHook),
    async (c) => {
      const input = c.req.valid("json");
      const userId = c.get("user").id;

      const credential = await prisma.credentials.findFirst({
        where: { id: input.credentialId, userId },
        select: { keys: true, platform: true },
      });
      if (!credential) {
        throw new HTTPException(404, { message: "Credential not found." });
      }
      if (!isSupportedAgentPlatform(credential.platform)) {
        throw new HTTPException(400, {
          message: "The selected credential is not a supported AI provider.",
        });
      }

      const keys = decryptJson<Record<string, unknown>>(
        credential.keys as string,
      );

      const normalizedApiKey =
        typeof keys.apiKey === "string" ? keys.apiKey.trim() : "";
      if (!normalizedApiKey) {
        throw new HTTPException(400, {
          message: "The selected credential has no API key.",
        });
      }

      let workflowContext = "No workflow is selected.";
      if (input.workflowId) {
        const workflow = await prisma.workflow.findFirst({
          where: { id: input.workflowId, userId },
          select: { id: true },
        });
        if (!workflow) {
          throw new HTTPException(404, { message: "Workflow not found." });
        }
        workflowContext = `Selected workflow ID: ${workflow.id}`;
      }

      let uiMessages: UIMessage[] | undefined;
      let modelMessages: ModelMessage[] | undefined;
      if (input.messages) {
        try {
          uiMessages = await validateUIMessages({ messages: input.messages });
          if (uiMessages.some((message) => message.role === "system")) {
            throw new HTTPException(400, {
              message: "System messages are not allowed in chat history.",
            });
          }
          modelMessages = await convertToModelMessages(uiMessages);
        } catch (error) {
          if (error instanceof HTTPException) throw error;
          throw new HTTPException(400, { message: "Invalid chat messages." });
        }
      }

      const model = getAgentModel(
        input.model,
        credential.platform,
        normalizedApiKey,
      );
      const tools = agentWorkflowTools(userId);
      const startedAt = performance.now();
      const persistencePrompt =
        input.prompt ?? getLastUserPrompt(uiMessages ?? []);

      let agentRunId: string | null = null;
      try {
        const agentRun = await prisma.workflowAgent.create({
          data: {
            userId,
            prompt: persistencePrompt,
            model: input.model,
            workflowId: input.workflowId ?? null,
          },
          select: { id: true },
        });
        agentRunId = agentRun.id;
      } catch (error) {
        console.error("Failed to create workflow agent record", error);
      }

      const finishAgentRun = (status: "Completed" | "Failed", result: unknown) => {
        if (!agentRunId) return;

        void prisma.workflowAgent
          .update({
            where: { id: agentRunId },
            data: { status, result: toJsonValue(result) },
          })
          .catch((error) => {
            console.error("Failed to update workflow agent record", error);
          });
      };

      const result = streamText({
        model,
        system: `${WORKFLOW_AGENT_SYSTEM_PROMPT}\n\nRequest context\n${workflowContext}`,
        ...(modelMessages
          ? { messages: modelMessages }
          : { prompt: input.prompt ?? "" }),
        tools,
        stopWhen: stepCountIs(6),
        abortSignal: c.req.raw.signal,
        onEnd: (event) => {
          finishAgentRun("Completed", {
            text: event.text,
            finishReason: event.finishReason,
            usage: {
              inputTokens: event.usage.inputTokens,
              outputTokens: event.usage.outputTokens,
              totalTokens: event.usage.totalTokens,
            },
            durationMs: Math.round(performance.now() - startedAt),
          });
        },
        onError: ({ error }) => {
          finishAgentRun("Failed", {
            message: error instanceof Error ? error.message : "Agent run failed.",
          });
        },
        onAbort: () => {
          finishAgentRun("Failed", { message: "Agent run aborted." });
        },
      });

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({
          stream: result.stream,
          tools,
          sendReasoning: false,
          ...(uiMessages ? { originalMessages: uiMessages } : {}),
          messageMetadata: ({ part }) => {
            if (part.type === "start") {
              return agentRunId ? { agentRunId } : undefined;
            }
            if (part.type !== "finish") {
              return undefined;
            }

            return {
              ...(agentRunId ? { agentRunId } : {}),
              tokenUsage: {
                inputTokens: part.totalUsage.inputTokens,
                outputTokens: part.totalUsage.outputTokens,
                totalTokens: part.totalUsage.totalTokens,
              },
              durationMs: Math.round(performance.now() - startedAt),
            };
          },
        }),
      });
    },
  );

export default app;