import { Hono } from "hono";
import type { User } from "../schemas/types";
import { createRateLimiter } from "../middleware/rateLimit";
import { prisma, Prisma, type WorkflowStatus } from "@WorkOrchestrator/prisma";
import { HTTPException } from "hono/http-exception";
import { createWorkflowInputSchema, executeWorkflowInputSchema, updateWorkflowInputSchema } from "../schemas/workflow";
import { zValidator } from "@hono/zod-validator";
import { validationHook } from "../lib/validator";
import { validateWorkflowGraph } from "../lib/workflow";

const app = new Hono<{ Variables: { user: User } }>();

app.use(createRateLimiter(120, 60_000))

function toJson(value: unknown): Prisma.InputJsonValue {
    if (value === null) {
        return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
    }
    return value as Prisma.InputJsonValue;
}

async function assertAvailableActionsExist(
    actionIds: readonly string[],
): Promise<void> {
    const uniqueIds = [...new Set(actionIds)];
    if (uniqueIds.length === 0) {
        return;
    }
    const found = await prisma.availableAction.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
    });
    const foundIds = new Set(found.map((action) => action.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
        throw new HTTPException(400, {
            message: `Unknown availableActionId(s): ${missing.join(", ")}`,
        });
    }
}

app.get("/workflows", async (c) => {
    const user = c.get("user");
    const userId = user.id;

    const workflows = await prisma.$queryRaw<
        Array<{
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            nodeCount: number;
            edgeCount: number;
            lastRunStatus: string | null;
            lastRunAt: Date | null;
        }>
    >`
    SELECT
      w."id",
      w."title",
      w."createdAt",
      w."updatedAt",
      CASE
        WHEN jsonb_typeof(w."nodes"::jsonb) = 'array'
        THEN jsonb_array_length(w."nodes"::jsonb)
        ELSE 0
      END::int AS "nodeCount",
      CASE
        WHEN jsonb_typeof(w."edges"::jsonb) = 'array'
        THEN jsonb_array_length(w."edges"::jsonb)
        ELSE 0
      END::int AS "edgeCount",
      lr."status"::text AS "lastRunStatus",
      lr."createdAt"    AS "lastRunAt"
    FROM "Workflow" w
    LEFT JOIN LATERAL (
      SELECT wr."status", wr."createdAt"
      FROM "WorkflowRun" wr
      WHERE wr."workflowId" = w."id"
      ORDER BY wr."createdAt" DESC
      LIMIT 1
    ) lr ON true
    WHERE w."userId" = ${userId}
    ORDER BY w."updatedAt" DESC;
  `;

    return c.json(
        workflows.map((workflow) => ({
            id: workflow.id,
            title: workflow.title,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt,
            nodeCount: workflow.nodeCount ?? 0,
            edgeCount: workflow.edgeCount ?? 0,
            lastRunStatus: workflow.lastRunStatus as WorkflowStatus | null,
            lastRunAt: workflow.lastRunAt,
        }))
    );
});

app.get("/workflows/:id",async (c)=>{
    const id=c.req.param("id")
    const userId=c.get("user").id
    const workflow=await prisma.workflow.findFirst({
        where:{
            id,
            userId
        },
        include:{
            trigger: {
                include: { type: true}
            },
            actions:{
                include:{type: true},
                orderBy:{sortingOrder:"asc"}
            }
        }
    })

    if (!workflow){
        throw new HTTPException(404,{message:"workflow not found"})
    }
    return c.json({ workflow });
})

app.delete("/workflows/:id", async (c) => {
    const id = c.req.param("id");
    const userId = c.get("user").id;
    const result = await prisma.workflow.deleteMany({
        where: { id, userId },
    });

    if (result.count === 0) {
        throw new HTTPException(404, { message: "workflow not found" });
    }

    return c.body(null, 204);
});

app.post("/create",zValidator("json",createWorkflowInputSchema,validationHook),async(c)=>{
    const body=c.req.valid("json")
    const userId=c.get("user").id

    const graphErrors=validateWorkflowGraph(body.nodes,body.edges)
    if (graphErrors.length!==0){
        throw new HTTPException(400,{message:`Invalid workflow graph: ${graphErrors.join("; ")}`})
    }

    const trigger=await prisma.availableTrigger.findUnique({
        where:{id:body.availableTriggerId},
        select:{id:true},
    })
    if (!trigger){
        throw new HTTPException(400,{message:`Unknown availableTriggerId: ${body.availableTriggerId}`})
    }

    await assertAvailableActionsExist(body.actions.map((action)=>action.availableActionId))

    const existing=await prisma.workflow.findUnique({
        where:{id:body.id},
        select:{id:true},
    })
    if (existing){
        throw new HTTPException(409,{message:`Workflow ${body.id} already exists`})
    }

    const workflow = await prisma.workflow.create({
        data: {
            id: body.id,
            title: body.title,
            userId: userId,
            nodes: toJson(body.nodes),
            edges: toJson(body.edges),
            trigger: {
                create: {
                    availableTriggerId: body.availableTriggerId,
                    metadata: toJson(body.triggerMetadata),
                },
            },
            actions: {
                create: body.actions.map((action, index) => ({
                    id: action.id,
                    availableActionId: action.availableActionId,
                    sortingOrder: index,
                    metadata: toJson(action.metadata),
                })),
            },
        },
        include: {
            trigger: {
                include: { type: true },
            },
            actions: {
                include: { type: true },
                orderBy: { sortingOrder: "asc" },
            },
        },
    });

    return c.json({workflow},201)
})

app.post("/update",zValidator("json",updateWorkflowInputSchema,validationHook),async(c)=>{
    const input=c.req.valid("json")
    const userId=c.get("user").id

    const existing=await prisma.workflow.findFirst({
        where:{
            id: input.id,
            userId: userId
        },
        select:{
            id:true,
            nodes:true,
            edges:true
        }
    })

    if (!existing) {
        throw new HTTPException(404,{message:"Workflow not found"});
    }

    if (input.nodes !== undefined || input.edges !== undefined) {
        const graphErrors = validateWorkflowGraph(
            input.nodes ?? (existing.nodes as unknown[]),
            input.edges ?? (existing.edges as unknown[]),
        );
        if (graphErrors.length !== 0) {
            throw new HTTPException(400, { message: `Invalid workflow graph: ${graphErrors.join("; ")}` })
        }
    }

    if (input.actions) {
        await assertAvailableActionsExist(input.actions.map((action)=>action.availableActionId))
    }

    const workflow=await prisma.$transaction(async (tx)=>{
        const updated=await tx.workflow.updateMany({
            where:{
                id: input.id,
                userId: userId,
            },
            data:{
                ...(input.title !== undefined && { title: input.title }),
                ...(input.nodes !== undefined && { nodes: toJson(input.nodes) }),
                ...(input.edges !== undefined && { edges: toJson(input.edges) }),
            },
        })

        if (updated.count===0){
            throw new HTTPException(404,{message:"Workflow not found"})
        }

        if (input.triggerMetadata !== undefined) {
            await tx.trigger.updateMany({
                where:{ workflowId: input.id },
                data:{ metadata: toJson(input.triggerMetadata) },
            })
        }

        if (input.actions) {
            await tx.action.deleteMany({ where: { workflowId: input.id } })
            if (input.actions.length > 0) {
                await tx.action.createMany({
                    data: input.actions.map((action, index) => ({
                        id: action.id,
                        workflowId: input.id,
                        availableActionId: action.availableActionId,
                        sortingOrder: index,
                        metadata: toJson(action.metadata),
                    })),
                })
            }
        }

        return tx.workflow.findUniqueOrThrow({
            where:{ id: input.id },
            include:{
                trigger:{
                    include:{ type:true }
                },
                actions:{
                    include:{ type:true },
                    orderBy:{ sortingOrder:"asc" }
                }
            }
        })
    })

    return c.json({workflow},200)
})

app.post("/execute",zValidator("json",executeWorkflowInputSchema,validationHook),async(c)=>{
    const input=c.req.valid("json")
    const userId=c.get("user").id
    const workflow=await prisma.workflow.findFirst({
        where:{
            id:input.nodeId,
            userId
        }
    })

    if (!workflow){
        throw new HTTPException(400,{message:"Workflow does not exist"})
    }

    const workflowNodes = Array.isArray(workflow.nodes)
        ? (workflow.nodes as Array<{
            id?: unknown;
            type?: unknown;
            data?: {
                isActive?: unknown;
                isConfigured?: unknown;
            } | null;
        }>)
        : [];
    if (input.nodeId && (input.triggerSource || input.triggerNodeId)) {
        throw new HTTPException(400, { message: "Provide either nodeId or triggerSource not both." }) 
    }
    if (
        (input.triggerSource && !input.triggerNodeId) ||
        (!input.triggerSource && input.triggerNodeId)
    ) {
        throw new HTTPException(400, { message: "Trigger source and tigger id must be provided." })
    }
    
    if (input.nodeId) {
        const nodeExists = workflowNodes.some(
            (node) => node?.id === input.nodeId,
        );
        if (!nodeExists) {
           throw new HTTPException(400, { message: "Node does not belong to this workflow." })
        }
        
    } else if (input.triggerSource && input.triggerNodeId) {
        const triggerNode = workflowNodes.find(
            (node) => node?.id === input.triggerNodeId,
        );
        if (!triggerNode) {
            throw new HTTPException(400, { message: "Trigger does not belong to this workflow" })
        }
        
    const nodeData =
        triggerNode.data && typeof triggerNode.data === "object"
            ? (triggerNode.data as {
                isActive?: unknown;
                isConfigured?: unknown;
            })
            : null;
    if (nodeData?.isActive === false) {
        throw new HTTPException(400, { message: "Selected trigger node is deactivated" })}
    if (nodeData?.isConfigured !== true) {
        throw new HTTPException(400, { message: "Selected trigger node not configured yet" })
    }
}
    else {
        const hasActiveManualTrigger = workflowNodes.some((node) => {
            const nodeType = typeof node?.type === "string" ? node.type : null;
            if (nodeType !== "manualTrigger" && nodeType !== "triggerNode") {
                return false;
            }
            const nodeData =
                node?.data && typeof node.data === "object"
                    ? (node.data as {
                        isActive?: unknown;
                    })
                    : null;
            return nodeData?.isActive !== false;
        });
        if (!hasActiveManualTrigger) {
            throw new HTTPException(400, {
                message: "Manual execution requires at least one active manual trigger node.Use webhook URL or cron schedule for this workflow." })
        }
    }

    let workflowRun
    try {
        workflowRun=await runWith
    } catch (error) {
        
    }
})  

export default app
