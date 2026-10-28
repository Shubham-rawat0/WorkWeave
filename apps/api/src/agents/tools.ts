import { tool, type Tool } from "ai"
import z from "zod"
import { createWorkflow, deleteWorkflow, executeWorkflow, getWorkflow, listWorkflows, updateWorkflow } from "../services/workflowService"
import { createWorkflowInputSchema, executeWorkflowInputSchema, MAX_ID_LENGTH, updateWorkflowInputSchema } from "../schemas/workflow";
import { prisma } from "@WorkOrchestrator/prisma";
import {
    getNodesByCategory,
    NODE_REGISTRY,
    type NodeCategory,
} from "@WorkOrchestrator/shared";
import { validateWorkflow } from "@WorkOrchestrator/shared/core";
import { validateWorkflowGraph } from "../lib/workflow";

interface WorkflowNode {
    id: string;
    type: string;
    data: Record<string, unknown>;
}

interface WorkflowEdge {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}

const list_available_triggers = tool({
    description: "list all the available and valid triggers that can be used in workflow",
    inputSchema: z.object({}),
    execute: async () => {
        return await prisma.availableTrigger.findMany({
            select: {
                id: true,
                name: true,
            },
        })
    }
})

const list_available_actions = tool({
    description: "list all the available and valid actions that can be performed in workflow",
    inputSchema: z.object({}),
    execute: async () => {
        return await prisma.availableAction.findMany({
            select: {
                id: true,
                name: true,
            },
        })
    }
})

const list_node_types = tool({
    description: "get the node type and node definition",
    inputSchema: z.object({
        category: z.enum(["triggers", "utilities", "integrations", "logic"]).optional()
    }),
    execute: ({ category }: { category?: NodeCategory }) => {
        if (category) {
            return getNodesByCategory()[category]
        }
        return NODE_REGISTRY
    }
})


const validate_workflow = tool({
    description: "Validate a workflow's node configuration and graph structure before execution.",
    inputSchema: z.object({
        nodes: z.array(z.object({
            id: z.string().trim().min(1),
            type: z.string().trim().min(1),
            data: z.record(z.string(), z.unknown()).default({}),
        }).loose()),
        edges: z.array(z.object({
            source: z.string().trim().min(1),
            target: z.string().trim().min(1),
            sourceHandle: z.string().nullable().optional(),
            targetHandle: z.string().nullable().optional(),
        }).loose()),
    }),
    execute: ({ nodes, edges }) => {
        const workflowNodes: WorkflowNode[] = nodes;
        const workflowEdges: WorkflowEdge[] = edges;
        const graphErrors = validateWorkflowGraph(workflowNodes, workflowEdges);
        const validation = validateWorkflow(workflowNodes, workflowEdges);
        const graphIssues = graphErrors
            .filter((message) =>
                message !== "Graph must not contain cycles." ||
                !validation.issues.some(
                    (issue) => issue.message === "Circular dependency detected in workflow",
                ),
            )
            .map((message) => ({
                type: "error" as const,
                category: "structure" as const,
                message,
            }));
        const issues = [...validation.issues, ...graphIssues];
        const hasErrors = issues.some((issue) => issue.type === "error");

        return {
            isValid: !hasErrors,
            canExecute: !hasErrors,
            issues,
        };
    }
})

export function agentWorkflowTools(userId: string): Record<string, Tool> {
    return {
        list_workflow: tool({
            description: "List all workflows belonging to the current user.",
            inputSchema: z.object({}),
            execute: async () => listWorkflows(userId),
        }),
        get_workflow: tool({
            description: "Get a particular workflow belonging to the current user.",
            inputSchema: z.object({
                workflowId: z.string().trim().min(1).max(MAX_ID_LENGTH),
            }),
            execute: async ({ workflowId }) => getWorkflow(userId, workflowId),
        }),
        list_available_actions,
        list_available_triggers,
        list_node_types,
        validate_workflow,
        create_workflow: tool({
            description: "Create a workflow for the current user with the provided configuration.",
            inputSchema: createWorkflowInputSchema,
            execute: async (input) => createWorkflow(userId, input),
        }),
        update_workflow: tool({
            description: "Update a workflow belonging to the current user.",
            inputSchema: updateWorkflowInputSchema,
            execute: async (input) => updateWorkflow(userId, input),
        }),
        execute_workflow: tool({
            description: "Queue an execution for a workflow belonging to the current user. Supports full manual runs, one node, or a configured cron/webhook trigger.",
            inputSchema: executeWorkflowInputSchema,
            execute: async (input) => {
                const run = await executeWorkflow(userId, input);
                return {
                    runId: run.id,
                    workflowId: input.workflowId,
                    status: run.status,
                };
            },
        }),
        delete_workflow: tool({
            description: "Delete a workflow belonging to the current user.",
            inputSchema: z.object({
                workflowId: z.string().trim().min(1).max(MAX_ID_LENGTH),
            }),
            execute: async ({ workflowId }) => {
                await deleteWorkflow(userId, workflowId);
                return { success: true, workflowId };
            },
        }),
        list_credentials: tool({
            description: "List the current user's saved credentials without returning secret keys.",
            inputSchema: z.object({}),
            execute: async () => prisma.credentials.findMany({
                where: { userId },
                select: {
                    id: true,
                    title: true,
                    platform: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { updatedAt: "desc" },
            }),
        }),
    };
}