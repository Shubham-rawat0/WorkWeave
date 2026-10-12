import z from "zod";
const MAX_WORKFLOW_TITLE_LENGTH = 200;
const MAX_WORKFLOW_NODES = 200;
const MAX_WORKFLOW_EDGES = 500;
const MAX_WORKFLOW_ACTIONS = 200;
const MAX_ID_LENGTH = 100;
export const EXECUTION_STREAM_TOKEN_TTL_SECONDS = 5 * 60;

export const jsonValueSchema = z.json();

export const workflowNodeSchema = z.looseObject({
    id: z.string().trim().min(1).max(MAX_ID_LENGTH),
});

export const workflowEdgeSchema = z.looseObject({
    source: z.string().trim().min(1).max(MAX_ID_LENGTH),
    target: z.string().trim().min(1).max(MAX_ID_LENGTH),
});

export const workflowActionInputSchema = z.object({
    id: z.string().min(1).max(MAX_ID_LENGTH),
    availableActionId: z.string().min(1).max(MAX_ID_LENGTH),
    metadata: jsonValueSchema,
});

export const createWorkflowInputSchema = z.object({
    id: z.string().min(1).max(MAX_ID_LENGTH),
    title: z.string().trim().min(1).max(MAX_WORKFLOW_TITLE_LENGTH),
    availableTriggerId: z.string().min(1).max(MAX_ID_LENGTH),
    triggerMetadata: jsonValueSchema,
    actions: z.array(workflowActionInputSchema).max(MAX_WORKFLOW_ACTIONS),
    nodes: z.array(workflowNodeSchema).max(MAX_WORKFLOW_NODES),
    edges: z.array(workflowEdgeSchema).max(MAX_WORKFLOW_EDGES),
});

export const updateWorkflowInputSchema = z
    .object({
        id: z.string().min(1).max(MAX_ID_LENGTH),
        title: z.string().trim().min(1).max(MAX_WORKFLOW_TITLE_LENGTH).optional(),
        nodes: z.array(workflowNodeSchema).max(MAX_WORKFLOW_NODES).optional(),
        edges: z.array(workflowEdgeSchema).max(MAX_WORKFLOW_EDGES).optional(),
        triggerMetadata: jsonValueSchema.optional(),
        actions: z
            .array(workflowActionInputSchema)
            .max(MAX_WORKFLOW_ACTIONS)
            .optional(),
    })
    .refine(
        (data) =>
            data.title !== undefined ||
            data.nodes !== undefined ||
            data.edges !== undefined ||
            data.triggerMetadata !== undefined ||
            data.actions !== undefined,
        { message: "At least one field must be provided to update" },
    );

export const executeWorkflowInputSchema = z.object({
    workflowId: z.string(),
    nodeId: z.string().optional(),
    triggerSource: z.enum(["cron", "webhook"]).optional(),
    triggerNodeId: z.string().optional(),
})