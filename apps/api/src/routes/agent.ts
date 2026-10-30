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
import { logger } from "../lib/logger";

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
      const requestId = crypto.randomUUID();

      let agentRunId: string | null = null;
      const logContext = () => ({
        requestId,
        userId,
        model: input.model,
        credentialId: input.credentialId,
        workflowId: input.workflowId ?? null,
        agentRunId,
      });

      c.header("X-Request-Id", requestId);

      const credential = await prisma.credentials.findFirst({
        where: { id: input.credentialId, userId },
        select: { keys: true, platform: true },
      });
      if (!credential) {
        logger.warn("agent.chat", "Credential not found", undefined, logContext());
        throw new HTTPException(404, { message: "Credential not found." });
      }
      if (!isSupportedAgentPlatform(credential.platform)) {
        logger.warn(
          "agent.chat",
          "Credential uses an unsupported provider",
          undefined,
          { ...logContext(), platform: credential.platform },
        );
        throw new HTTPException(400, {
          message: "The selected credential is not a supported AI provider.",
        });
      }

      let keys: Record<string, unknown>;
      try {
        keys = decryptJson<Record<string, unknown>>(credential.keys as string);
      } catch (error) {
        logger.error(
          "agent.chat",
          "Failed to decrypt credential",
          error,
          { ...logContext(), platform: credential.platform },
        );
        throw new HTTPException(500, {
          message: "Failed to read the selected credential.",
        });
      }

      const normalizedApiKey =
        typeof keys.apiKey === "string" ? keys.apiKey.trim() : "";
      if (!normalizedApiKey) {
        logger.warn(
          "agent.chat",
          "Credential has no API key",
          undefined,
          { ...logContext(), platform: credential.platform },
        );
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
          logger.warn("agent.chat", "Workflow not found", undefined, logContext());
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
          logger.warn(
            "agent.chat",
            "Invalid chat message history",
            error,
            logContext(),
          );
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
        logger.error(
          "agent.chat",
          "Failed to create workflow agent record",
          error,
          logContext(),
        );
      }

      const finishAgentRun = (status: "Completed" | "Failed", result: unknown) => {
        if (!agentRunId) return;

        void prisma.workflowAgent
          .update({
            where: { id: agentRunId },
            data: { status, result: toJsonValue(result) },
          })
          .catch((error) => {
            logger.error(
              "agent.chat",
              "Failed to update workflow agent record",
              error,
              logContext(),
            );
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
            requestId,
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
          logger.error(
            "agent.chat",
            "Agent stream failed",
            error,
            {
              ...logContext(),
              durationMs: Math.round(performance.now() - startedAt),
            },
          );
          finishAgentRun("Failed", {
            message: error instanceof Error ? error.message : "Agent run failed.",
          });
        },
        onAbort: () => {
          logger.warn(
            "agent.chat",
            "Agent stream aborted by client",
            undefined,
            {
              ...logContext(),
              durationMs: Math.round(performance.now() - startedAt),
            },
          );
          finishAgentRun("Failed", { message: "Agent run aborted." });
        },
      });

      const response = createUIMessageStreamResponse({
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

      response.headers.set("X-Request-Id", requestId);
      return response;
    },
  );

export default app;