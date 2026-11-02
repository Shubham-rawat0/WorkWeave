import { Hono } from "hono";
import type { User } from "../schemas/types";
import { createRateLimiter } from "../middleware/rateLimit";
import { prisma } from "@WorkOrchestrator/prisma";
import { HTTPException } from "hono/http-exception";
import { createWorkflowInputSchema, executeWorkflowInputSchema, EXECUTION_STREAM_TOKEN_TTL_SECONDS, updateWorkflowInputSchema, workflowRunsInputSchema } from "../schemas/workflow";
import { zValidator } from "@hono/zod-validator";
import { validationHook } from "../lib/validator";
import { getRunSource } from "../lib/workflow";
import { getWorkflowQueue } from "@WorkOrchestrator/shared/queue";
import { resolveExecutionStreamSigningSecret, resolveExecutionStreamWsBaseUrlFromEnv } from "../lib/ws";
import { signExecutionStreamToken } from "@WorkOrchestrator/shared/executionSignature";
import { createWorkflow, deleteWorkflow, executeWorkflow, getWorkflow, listWorkflows, updateWorkflow } from "../services/workflowService";

// Mints a short-lived signed WS token + client bootstrap so the creator of a
// run can watch its live events without a full auth handshake per reconnect.
function createExecutionStreamBootstrap(runId: string, userId: string) {
    const token = signExecutionStreamToken(
        {
            runId,
            userId,
            ttlSeconds: EXECUTION_STREAM_TOKEN_TTL_SECONDS,
        },
        resolveExecutionStreamSigningSecret(),
    );
    const wsUrl = resolveExecutionStreamWsBaseUrlFromEnv();
    return {
        token,
        expiresInSeconds: EXECUTION_STREAM_TOKEN_TTL_SECONDS,
        ...(wsUrl ? { wsUrl } : {}),
    };
}

const app = new Hono<{ Variables: { user: User } }>()
    .use("*", createRateLimiter(120, 60_000))
    .get("/", async (c) => {
    return c.json(await listWorkflows(c.get("user").id));
})

.get("/runs",async(c)=>{
    const input=workflowRunsInputSchema.parse(c.req.query())
    const userId=c.get("user").id
    const workflowRuns=await prisma.workflowRun.findMany({
        where:{
            workflowId:input.workflowId,
            workflow:{ userId },
            ...(input.status && { status: input.status }),
        },
        include: {
            workflow: { select: { id: true, title: true } },
            nodeRuns: { orderBy: { startedAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && {
            cursor: { id: input.cursor },
            skip: 1,
        }),
    })

    let nextCursor: string | undefined;

    if (workflowRuns.length > input.limit) {
        workflowRuns.pop();

        nextCursor = workflowRuns[workflowRuns.length - 1]?.id;
    }
    const hydratedworkflowRuns = workflowRuns.map((run) => ({
        ...run,
        source: getRunSource(run.metadata),
    }));
    return c.json({ workflowRuns: hydratedworkflowRuns, nextCursor });
})

.get("/usage", async (c) => {
    const userId = c.get("user").id;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const usage = await prisma.usageRecord.findUnique({
        where: { userId_month: { userId, month } },
        select: { runCount: true },
    });
    return c.json({
        month,
        runCount: usage?.runCount ?? 0,
        limit: 1000,
    });
})

.get("/:id",async (c)=>{
    return c.json(await getWorkflow(c.get("user").id, c.req.param("id")));
})

.delete("/:id", async (c) => {
    await deleteWorkflow(c.get("user").id, c.req.param("id"));
    return c.body(null, 204);
})

.post("/create", zValidator("json", createWorkflowInputSchema, validationHook), async (c) => {
    const result = await createWorkflow(c.get("user").id, c.req.valid("json"));
    return c.json(result, 201);
})

.post("/update", zValidator("json", updateWorkflowInputSchema, validationHook), async (c) => {
    const result = await updateWorkflow(c.get("user").id, c.req.valid("json"));
    return c.json(result, 200);
})

.post("/execute", zValidator("json", executeWorkflowInputSchema, validationHook), async (c) => {
    const input = c.req.valid("json");
    const userId = c.get("user").id;
    const workflowRun = await executeWorkflow(userId, input);
    let stream: { token: string; wsUrl?: string; expiresInSeconds: number } | undefined;
    try {
        stream = createExecutionStreamBootstrap(workflowRun.id, userId);
    } catch (error) {
        console.warn("[workflow.execute] Failed to prepare execution stream bootstrap token.", error);
    }
    return c.json({
        runId: workflowRun.id,
        workflowId: input.workflowId,
        ...(stream ? { stream } : {}),
    });
})

.get("/workflow/run/:id",async(c)=>{
    const runId=c.req.param("id")
    const run = await prisma.workflowRun.findUnique({
        where: { id: runId },
        include: {
            workflow: {
                select: {
                    id: true,
                    title: true,
                    userId: true,
                    nodes: true,
                    edges: true,
                },
            },
            nodeRuns: {
                orderBy: { startedAt: "asc" },
            },
        },
    });
    if (!run) {
        throw new HTTPException(
            403,
            {message: "Execution not found",
        });
    }
    const userId=c.get("user").id

    if (run.workflow.userId !== userId) {
        throw new HTTPException(
            401,
            {message: "Not authorized to view this execution",
        });
    }
    return c.json({
        ...run,
        source: getRunSource(run.metadata),
    });
})

.post("/workflow/run/:id/cancel", async (c) => {
    const runId = c.req.param("id");
    const userId = c.get("user").id;
    // Guarded update acts as CAS: only Pending runs flip to Cancelled; the
    // worker rechecks status before starting, so it skips this id either way.
    const result = await prisma.workflowRun.updateMany({
        where: {
            id: runId,
            status: "Pending",
            workflow: { userId },
        },
        data: {
            status: "Cancelled",
            finishedAt: new Date(),
            errorMetadata: {
                message: "Execution cancelled by user",
            },
        },
    });

    if (result.count === 0) {
        const run = await prisma.workflowRun.findFirst({
            where: { id: runId, workflow: { userId } },
            select: { status: true },
        });
        if (!run) {
            throw new HTTPException(404, { message: "Execution not found" });
        }
        throw new HTTPException(409, {
            message: "Only pending executions can be cancelled.",
        });
    }

    try {
        const job = await getWorkflowQueue().getJob(runId);
        if (job) {
            const state = await job.getState();
            if (state !== "active" && state !== "completed" && state !== "failed") {
                await job.remove();
            }
        }
    } catch (error) {
        console.warn(
            `[workflow.run.cancel] Could not remove queued job ${runId}; the worker will skip the cancelled run.`,
            error,
        );
    }

    return c.json({ runId, status: "Cancelled" as const });
})

.get("/workflow/run/:id/stream", async (c) => {
    const runId = c.req.param("id");
    const userId = c.get("user").id;
    const run = await prisma.workflowRun.findFirst({
        where: {
            id: runId,
            workflow: { userId },
        },
        select: { id: true },
    });
    if (!run) {
        throw new HTTPException(404, { message: "Execution not found" });
    }

    try {
        return c.json({ stream: createExecutionStreamBootstrap(run.id, userId) });
    } catch (error) {
        console.error("[workflow.run.stream] Failed to prepare stream token.", error);
        throw new HTTPException(503, {
            message: "Execution event stream is unavailable.",
        });
    }
});
export default app
