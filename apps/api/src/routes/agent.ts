import { prisma, type User } from "@WorkOrchestrator/prisma";
import { Hono } from "hono";
import { createRateLimiter } from "../middleware/rateLimit";
import { workflowAgentInputSchema } from "../schemas/agents";
import { zValidator } from "@hono/zod-validator";
import { validationHook } from "../lib/validator";
import { getAgentModel } from "../utils/model";
import { agentWorkflowTools } from "../agents/tools";
import { HTTPException } from "hono/http-exception";
import { decryptJson } from "@WorkOrchestrator/shared/crypto";
import {
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from "ai";
import { WORKFLOW_AGENT_SYSTEM_PROMPT } from "../agents/prompt";

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

      const tools = agentWorkflowTools(userId);
      const startedAt = performance.now();
      const result = streamText({
        model: getAgentModel(
          input.model,
          credential.platform,
          normalizedApiKey,
        ),
        system: `${WORKFLOW_AGENT_SYSTEM_PROMPT}\n\nRequest context\n${workflowContext}`,
        prompt: input.prompt,
        tools,
        stopWhen: stepCountIs(6),
      });

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({
          stream: result.stream,
          tools,
          sendReasoning: false,
          messageMetadata: ({ part }) => {
            if (part.type !== "finish") {
              return undefined;
            }

            return {
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