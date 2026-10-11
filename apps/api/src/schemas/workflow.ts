import z from "zod";
const MAX_WORKFLOW_TITLE_LENGTH = 200;
const MAX_WORKFLOW_NODES = 200;
const MAX_WORKFLOW_EDGES = 500;
const MAX_WORKFLOW_ACTIONS = 200;
export const EXECUTION_STREAM_TOKEN_TTL_SECONDS = 5 * 60;

export const jsonValueSchema = z.unknown();

export const workflowActionInputSchema = z.object({
    id: z.string().min(1).max(100),
    availableActionId: z.string().min(1).max(100),
    metadata: jsonValueSchema,
});

export const createWorkflowInputSchema = z.object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(MAX_WORKFLOW_TITLE_LENGTH),
    availableTriggerId: z.string().min(1).max(100),
    triggerMetadata: jsonValueSchema,
    actions: z.array(workflowActionInputSchema).max(MAX_WORKFLOW_ACTIONS),
    nodes: z.array(jsonValueSchema).max(MAX_WORKFLOW_NODES),
    edges: z.array(jsonValueSchema).max(MAX_WORKFLOW_EDGES),
});

export const updateWorkflowInputSchema = z.object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(MAX_WORKFLOW_TITLE_LENGTH).optional(),
    nodes: z.array(jsonValueSchema).max(MAX_WORKFLOW_NODES).optional(),
    edges: z.array(jsonValueSchema).max(MAX_WORKFLOW_EDGES).optional(),
    triggerMetadata: jsonValueSchema.optional(),
    actions: z
        .array(workflowActionInputSchema)
        .max(MAX_WORKFLOW_ACTIONS)
        .optional(),
});
