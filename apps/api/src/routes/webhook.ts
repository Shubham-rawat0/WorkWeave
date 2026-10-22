import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { prisma, Prisma } from "@WorkOrchestrator/prisma";
import { getWorkflowQueue } from "@WorkOrchestrator/shared/queue";
import {
  RunReservationLockTimeoutError,
  withUserRunReservationLock,
} from "@WorkOrchestrator/shared/runLock";
import { createRateLimiter } from "../middleware/rateLimit";
import { hashWebhookToken } from "../lib/webhooks";

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
const RESERVED_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-api-key",
]);

function toJson(value: unknown): Prisma.InputJsonValue {
  if (value === null) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }
  return value as Prisma.InputJsonValue;
}

function getSafeHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(
    [...headers.entries()].filter(
      ([name]) => !RESERVED_HEADERS.has(name.toLowerCase()),
    ),
  );
}

function getQueryParams(url: URL): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  }
  return query;
}

const app = new Hono().use("*", createRateLimiter(60, 60_000)).post(
  "/:workflowId/:token",
  bodyLimit({
    maxSize: MAX_WEBHOOK_BODY_BYTES,
    onError: (c) => c.json({ message: "Webhook payload is too large" }, 413),
  }),
  async (c) => {
    const { workflowId, token } = c.req.param();
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new HTTPException(404, { message: "Webhook not found" });
    }

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: {
        workflowId,
        tokenHash: hashWebhookToken(token),
        enabled: true,
      },
      include: {
        workflow: {
          select: {
            nodes: true,
            userId: true,
          },
        },
      },
    });
    if (!endpoint || !endpoint.workflow.userId) {
      throw new HTTPException(404, { message: "Webhook not found" });
    }

    const node = Array.isArray(endpoint.workflow.nodes)
      ? endpoint.workflow.nodes.find(
          (candidate) =>
            typeof candidate === "object" &&
            candidate !== null &&
            "id" in candidate &&
            candidate.id === endpoint.nodeId &&
            "type" in candidate &&
            candidate.type === "webhookTrigger",
        )
      : undefined;
    const nodeData =
      typeof node === "object" && node !== null && "data" in node
        ? node.data
        : null;
    if (
      !node ||
      typeof nodeData !== "object" ||
      nodeData === null ||
      ("isActive" in nodeData && nodeData.isActive === false) ||
      !("isConfigured" in nodeData) ||
      nodeData.isConfigured !== true
    ) {
      throw new HTTPException(404, { message: "Webhook not found" });
    }

    const rawBody = await c.req.text();

    let payload: unknown = {};
    if (rawBody.length > 0) {
      const contentType = c.req.header("content-type")?.toLowerCase() ?? "";
      if (
        contentType.includes("application/json") ||
        contentType.includes("+json")
      ) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          throw new HTTPException(400, {
            message: "Invalid JSON webhook payload",
          });
        }
      } else {
        payload = rawBody;
      }
    }

    const userId = endpoint.workflow.userId;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let workflowRun;
    try {
      workflowRun = await withUserRunReservationLock(userId, () =>
        prisma.$transaction(async (tx) => {
          await tx.usageRecord.upsert({
            where: { userId_month: { userId, month } },
            create: { userId, month, runCount: 0 },
            update: {},
          });
          const userLimits = await tx.user.findUnique({
            where: { id: userId },
            select: { maxConcurrent: true },
          });
          const maxConcurrent = userLimits?.maxConcurrent ?? 2;
          const pendingRuns = await tx.workflowRun.count({
            where: {
              status: "Pending",
              workflow: { userId },
            },
          });
          if (pendingRuns >= maxConcurrent) {
            throw new HTTPException(409, {
              message: `Concurrent workflow limit reached (${maxConcurrent}).`,
            });
          }

          await tx.usageRecord.update({
            where: { userId_month: { userId, month } },
            data: { runCount: { increment: 1 } },
          });

          return tx.workflowRun.create({
            data: {
              workflowId,
              metadata: toJson({
                source: "webhook",
                nodeId: endpoint.nodeId,
                payload,
                query: getQueryParams(new URL(c.req.url)),
                headers: getSafeHeaders(c.req.raw.headers),
                receivedAt: new Date().toISOString(),
              }),
            },
          });
        }),
      );
    } catch (error) {
      if (error instanceof RunReservationLockTimeoutError) {
        throw new HTTPException(409, {
          message:
            "Another execution request is being processed. Please retry shortly.",
        });
      }
      throw error;
    }

    try {
      await getWorkflowQueue().add(
        "process-workflow",
        { workflowRunId: workflowRun.id },
        { jobId: workflowRun.id },
      );
    } catch (error) {
      await prisma.$transaction([
        prisma.workflowRun.update({
          where: { id: workflowRun.id },
          data: {
            status: "Failure",
            finishedAt: new Date(),
            errorMetadata: {
              message: "Failed to enqueue webhook workflow run",
            },
          },
        }),
        prisma.usageRecord.update({
          where: { userId_month: { userId, month } },
          data: { runCount: { decrement: 1 } },
        }),
      ]);
      console.error("[webhook] Failed to enqueue workflow run:", error);
      throw new HTTPException(500, {
        message: "Failed to enqueue workflow run",
      });
    }

    return c.json({ runId: workflowRun.id }, 202);
  },
);

export default app;
