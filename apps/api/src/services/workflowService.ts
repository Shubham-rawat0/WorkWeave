import { HTTPException } from "hono/http-exception";
import { prisma, Prisma } from "@WorkOrchestrator/prisma";
import { getWorkflowQueue } from "@WorkOrchestrator/shared/queue";
import { RunReservationLockTimeoutError, withUserRunReservationLock } from "@WorkOrchestrator/shared/runLock";
import { getWebhookEndpointUrls, syncWebhookEndpoints } from "../lib/webhooks";
import { validateWorkflowGraph } from "../lib/workflow";
import type { createWorkflowInputSchema, executeWorkflowInputSchema, updateWorkflowInputSchema } from "../schemas/workflow";
import type { z } from "zod";

export type CreateWorkflowInput = z.infer<typeof createWorkflowInputSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowInputSchema>;
export type ExecuteWorkflowInput = z.infer<typeof executeWorkflowInputSchema>;

// Prisma requires its JsonNull sentinel for null JSON columns; objects and
// arrays can be passed through unchanged.
function toJson(value: unknown): Prisma.InputJsonValue {
    return value === null
        ? Prisma.JsonNull as unknown as Prisma.InputJsonValue
        : value as Prisma.InputJsonValue;
}

// The exported client is extended with retry logic, so its transaction
// callback type is structurally narrower than Prisma.TransactionClient.
function asTransactionClient(client: unknown): Prisma.TransactionClient {
    return client as Prisma.TransactionClient;
}

async function assertAvailableActionsExist(actionIds: readonly string[]): Promise<void> {
    const uniqueIds = [...new Set(actionIds)];
    if (uniqueIds.length === 0) return;
    const found = await prisma.availableAction.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
    });
    const foundIds = new Set(found.map((action) => action.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
        throw new HTTPException(400, { message: `Unknown availableActionId(s): ${missing.join(", ")}` });
    }
}

export async function listWorkflows(userId: string) {
    const workflows = await prisma.$queryRaw<Array<{
        id: string; title: string; createdAt: Date; updatedAt: Date;
        nodeCount: number; edgeCount: number; lastRunStatus: string | null; lastRunAt: Date | null;
    }>>`
        SELECT w."id", w."title", w."createdAt", w."updatedAt",
          CASE WHEN jsonb_typeof(w."nodes"::jsonb) = 'array' THEN jsonb_array_length(w."nodes"::jsonb) ELSE 0 END::int AS "nodeCount",
          CASE WHEN jsonb_typeof(w."edges"::jsonb) = 'array' THEN jsonb_array_length(w."edges"::jsonb) ELSE 0 END::int AS "edgeCount",
          lr."status"::text AS "lastRunStatus", lr."createdAt" AS "lastRunAt"
        FROM "Workflow" w
        LEFT JOIN LATERAL (
          SELECT wr."status", wr."createdAt" FROM "WorkflowRun" wr
          WHERE wr."workflowId" = w."id" ORDER BY wr."createdAt" DESC LIMIT 1
        ) lr ON true
        WHERE w."userId" = ${userId}
        ORDER BY w."updatedAt" DESC;
    `;
    return workflows.map((workflow) => ({
        ...workflow,
        nodeCount: workflow.nodeCount ?? 0,
        edgeCount: workflow.edgeCount ?? 0,
    }));
}

export async function getWorkflow(userId: string, id: string) {
    const workflow = await prisma.workflow.findFirst({
        where: { id, userId },
        include: {
            trigger: { include: { type: true } },
            actions: { include: { type: true }, orderBy: { sortingOrder: "asc" } },
        },
    });
    if (!workflow) throw new HTTPException(404, { message: "workflow not found" });
    return { workflow, webhookEndpoints: await getWebhookEndpointUrls(workflow.id) };
}

export async function createWorkflow(userId: string, input: CreateWorkflowInput) {
    // Validate before opening the transaction so invalid references never get persisted.
    const graphErrors = validateWorkflowGraph(input.nodes, input.edges);
    if (graphErrors.length) throw new HTTPException(400, { message: `Invalid workflow graph: ${graphErrors.join("; ")}` });
    const trigger = await prisma.availableTrigger.findUnique({ where: { id: input.availableTriggerId }, select: { id: true } });
    if (!trigger) throw new HTTPException(400, { message: `Unknown availableTriggerId: ${input.availableTriggerId}` });
    await assertAvailableActionsExist(input.actions.map((action) => action.availableActionId));
    const existing = await prisma.workflow.findUnique({ where: { id: input.id }, select: { id: true } });
    if (existing) throw new HTTPException(409, { message: `Workflow ${input.id} already exists` });

    const workflow = await prisma.$transaction(async (tx) => {
        const created = await tx.workflow.create({
            data: {
                id: input.id, title: input.title, userId,
                nodes: toJson(input.nodes), edges: toJson(input.edges),
                trigger: { create: { availableTriggerId: input.availableTriggerId, metadata: toJson(input.triggerMetadata) } },
                actions: { create: input.actions.map((action, index) => ({
                    id: action.id, availableActionId: action.availableActionId,
                    sortingOrder: index, metadata: toJson(action.metadata),
                })) },
            },
            include: {
                trigger: { include: { type: true } },
                actions: { include: { type: true }, orderBy: { sortingOrder: "asc" } },
            },
        });
        await syncWebhookEndpoints(asTransactionClient(tx), created.id, input.nodes);
        return created;
    });
    return { workflow, webhookEndpoints: await getWebhookEndpointUrls(workflow.id) };
}

export async function updateWorkflow(userId: string, input: UpdateWorkflowInput) {
    const existing = await prisma.workflow.findFirst({
        where: { id: input.id, userId }, select: { id: true, nodes: true, edges: true },
    });
    if (!existing) throw new HTTPException(404, { message: "Workflow not found" });
    if (input.nodes !== undefined || input.edges !== undefined) {
        const errors = validateWorkflowGraph(input.nodes ?? existing.nodes as unknown[], input.edges ?? existing.edges as unknown[]);
        if (errors.length) throw new HTTPException(400, { message: `Invalid workflow graph: ${errors.join("; ")}` });
    }
    if (input.actions) await assertAvailableActionsExist(input.actions.map((action) => action.availableActionId));

    const workflow = await prisma.$transaction(async (tx) => {
        const updated = await tx.workflow.updateMany({
            where: { id: input.id, userId },
            data: {
                ...(input.title !== undefined && { title: input.title }),
                ...(input.nodes !== undefined && { nodes: toJson(input.nodes) }),
                ...(input.edges !== undefined && { edges: toJson(input.edges) }),
            },
        });
        if (!updated.count) throw new HTTPException(404, { message: "Workflow not found" });
        // Keep webhook endpoints in the same transaction as the saved graph.
        await syncWebhookEndpoints(asTransactionClient(tx), input.id, input.nodes ?? existing.nodes);
        if (input.triggerMetadata !== undefined) {
            await tx.trigger.updateMany({ where: { workflowId: input.id }, data: { metadata: toJson(input.triggerMetadata) } });
        }
        if (input.actions) {
            await tx.action.deleteMany({ where: { workflowId: input.id } });
            if (input.actions.length) await tx.action.createMany({ data: input.actions.map((action, index) => ({
                id: action.id, workflowId: input.id, availableActionId: action.availableActionId,
                sortingOrder: index, metadata: toJson(action.metadata),
            })) });
        }
        return tx.workflow.findUniqueOrThrow({
            where: { id: input.id },
            include: {
                trigger: { include: { type: true } },
                actions: { include: { type: true }, orderBy: { sortingOrder: "asc" } },
            },
        });
    });
    return { workflow, webhookEndpoints: await getWebhookEndpointUrls(workflow.id) };
}

export async function deleteWorkflow(userId: string, id: string): Promise<void> {
    const result = await prisma.workflow.deleteMany({ where: { id, userId } });
    if (!result.count) throw new HTTPException(404, { message: "workflow not found" });
}

export async function executeWorkflow(userId: string, input: ExecuteWorkflowInput) {
    // Run modes are mutually exclusive: nodeId is a single-node manual run;
    // triggerSource + triggerNodeId is webhook/cron; no parameters is full manual.
    if (input.nodeId && (input.triggerSource || input.triggerNodeId)) {
        throw new HTTPException(400, { message: "Provide either nodeId or triggerSource not both." });
    }
    if ((input.triggerSource && !input.triggerNodeId) || (!input.triggerSource && input.triggerNodeId)) {
        throw new HTTPException(400, { message: "Trigger source and trigger id must be provided." });
    }
    const workflow = await prisma.workflow.findFirst({ where: { id: input.workflowId, userId } });
    if (!workflow) throw new HTTPException(404, { message: "Workflow does not exist" });
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes as Array<{
        id?: unknown; type?: unknown; data?: { isActive?: unknown; isConfigured?: unknown } | null;
    }> : [];
    if (input.nodeId) {
        if (!nodes.some((node) => node?.id === input.nodeId)) throw new HTTPException(400, { message: "Node does not belong to this workflow." });
    } else if (input.triggerSource && input.triggerNodeId) {
        const triggerNode = nodes.find((node) => node?.id === input.triggerNodeId);
        if (!triggerNode) throw new HTTPException(400, { message: "Trigger does not belong to this workflow" });
        const expected = input.triggerSource === "cron" ? "cronTrigger" : "webhookTrigger";
        if (triggerNode.type !== expected) throw new HTTPException(400, { message: `${input.triggerSource} execution requires a ${expected} node.` });
        const data = triggerNode.data && typeof triggerNode.data === "object" ? triggerNode.data : null;
        if (data?.isActive === false) throw new HTTPException(400, { message: "Selected trigger node is deactivated" });
        if (data?.isConfigured !== true) throw new HTTPException(400, { message: "Selected trigger node not configured yet" });
    } else {
        const hasManualTrigger = nodes.some((node) => {
            if (node?.type !== "manualTrigger" && node?.type !== "triggerNode") return false;
            const data = node.data && typeof node.data === "object" ? node.data : null;
            return data?.isActive !== false;
        });
        if (!hasManualTrigger) throw new HTTPException(400, { message: "Manual execution requires at least one active manual trigger node.Use webhook URL or cron schedule for this workflow." });
    }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let workflowRun;
    try {
        // Serialize each user's concurrency check so simultaneous requests
        // cannot both pass the pending-run limit.
        workflowRun = await withUserRunReservationLock(userId, () => prisma.$transaction(async (tx) => {
            await tx.usageRecord.upsert({ where: { userId_month: { userId, month } }, create: { userId, month, runCount: 0 }, update: {} });
            const userLimits = await tx.user.findUnique({ where: { id: userId }, select: { maxConcurrent: true } });
            const maxConcurrent = userLimits?.maxConcurrent ?? 2;
            const pendingRuns = await tx.workflowRun.count({ where: { status: "Pending", workflow: { userId } } });
            if (pendingRuns >= maxConcurrent) throw new HTTPException(409, { message: `Concurrent workflow limit reached ${maxConcurrent}. Wait for current executions to finish or upgrade your plan.` });
            await tx.usageRecord.update({ where: { userId_month: { userId, month } }, data: { runCount: { increment: 1 } } });
            return tx.workflowRun.create({
                data: { workflowId: input.workflowId, metadata: (() => {
                    const nowIso = new Date().toISOString();
                    if (input.nodeId) return { source: "manual-node", nodeId: input.nodeId };
                    if (input.triggerSource && input.triggerNodeId) {
                        return input.triggerSource === "cron"
                            ? { source: "cron", nodeId: input.triggerNodeId, scheduledAt: nowIso }
                            : { source: "webhook", nodeId: input.triggerNodeId, payload: {}, query: {}, headers: {}, receivedAt: nowIso, ip: "manual-run-now" };
                    }
                    return { source: "manual" };
                })() },
            });
        }));
    } catch (error) {
        if (error instanceof RunReservationLockTimeoutError) throw new HTTPException(409, { message: "Another execution request is being processed. Please retry in a moment." });
        throw error;
    }
    try {
        // The run id is also the queue dedupe key used by the cancellation route.
        await getWorkflowQueue().add("process-workflow", { workflowRunId: workflowRun.id }, { jobId: workflowRun.id });
    } catch {
        // Do not charge usage for a run that never reached the queue.
        await prisma.$transaction([
            prisma.workflowRun.update({ where: { id: workflowRun.id }, data: { status: "Failure", finishedAt: new Date(), errorMetadata: { message: "Failed to enqueue workflow run" } as any } }),
            prisma.usageRecord.update({ where: { userId_month: { userId, month } }, data: { runCount: { decrement: 1 } } }),
        ]);
        throw new HTTPException(500, { message: "Failed to enqueue workflow run" });
    }
    return workflowRun;
}
