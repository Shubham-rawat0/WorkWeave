import { tool, type Tool } from "ai"
import z from "zod"
import { createWorkflow, deleteWorkflow, executeWorkflow, getWorkflow, listWorkflows, updateWorkflow } from "../services/workflowService"
import { createWorkflowInputSchema, executeWorkflowInputSchema, updateWorkflowInputSchema, workflowIdInputSchema } from "../schemas/workflow";
import { prisma } from "@WorkOrchestrator/prisma";
import {
    getNodesByCategory,
    NODE_REGISTRY,
    type NodeCategory,
} from "@WorkOrchestrator/shared";
import { validateWorkflow } from "@WorkOrchestrator/shared/core";
import { validateWorkflowGraph } from "../lib/workflow";
import { HTTPException } from "hono/http-exception";

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

const MAX_TOOL_ITEMS = 100;

function safeToolError(error: unknown) {
    if (error instanceof HTTPException) {
        return { error: { code: `HTTP_${error.status}`, message: error.message } };
    }
    return { error: { code: "TOOL_FAILED", message: "The requested operation failed." } };
}

function workflowSummary(result: any) {
    const workflow = result.workflow;
    return {
        workflow: {
            id: workflow.id,
            title: workflow.title,
            createdAt: workflow.createdAt?.toISOString?.() ?? null,
            updatedAt: workflow.updatedAt?.toISOString?.() ?? null,
            nodes: Array.isArray(workflow.nodes) ? workflow.nodes.slice(0, MAX_TOOL_ITEMS).map((node: any) => ({
                id: typeof node?.id === "string" ? node.id.slice(0, 100) : "",
                type: typeof node?.type === "string" ? node.type.slice(0, 100) : "",
                dataFields: node?.data && typeof node.data === "object" && !Array.isArray(node.data)
                    ? Object.keys(node.data).slice(0, 50)
                    : [],
            })) : [],
            edges: Array.isArray(workflow.edges) ? workflow.edges.slice(0, MAX_TOOL_ITEMS).map((edge: any) => ({
                source: typeof edge?.source === "string" ? edge.source.slice(0, 100) : "",
                target: typeof edge?.target === "string" ? edge.target.slice(0, 100) : "",
            })) : [],
            trigger: workflow.trigger ? {
                id: workflow.trigger.id,
                availableTriggerId: workflow.trigger.availableTriggerId,
                name: workflow.trigger.type?.name,
            } : null,
            actions: Array.isArray(workflow.actions) ? workflow.actions.slice(0, MAX_TOOL_ITEMS).map((action: any) => ({
                id: action.id,
                availableActionId: action.availableActionId,
                sortingOrder: action.sortingOrder,
                name: action.type?.name,
            })) : [],
        },
        webhookEndpointCount: Array.isArray(result.webhookEndpoints) ? result.webhookEndpoints.length : 0,
    };
}

async function assertWorkflowOwned(userId: string, workflowId: string) {
    const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, userId }, select: { id: true } });
    if (!workflow) throw new HTTPException(404, { message: "Workflow not found" });
}

const list_available_triggers = tool({
    description: "List up to 100 available trigger types for configuring a workflow. Returns only each trigger's ID and display name.",
    inputSchema: z.object({}),
    execute: async () => {
        return await prisma.availableTrigger.findMany({
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
            },
        })
    }
})

const list_available_actions = tool({
    description: "List up to 100 available action types for configuring a workflow. Returns only each action's ID and display name.",
    inputSchema: z.object({}),
    execute: async () => {
        return await prisma.availableAction.findMany({
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
            },
        })
    }
})

const list_node_types = tool({
    description: "Get registered workflow node definitions, optionally filtered by category. Returns definitions suitable for building or validating workflow nodes.",
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
    description: "Validate a proposed workflow's node configuration and graph structure without saving or executing it. Returns validity and actionable validation issues.",
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
            issues: issues.slice(0, MAX_TOOL_ITEMS),
        };
    }
})

export function agentWorkflowTools(userId: string): Record<string, Tool> {
    return {
        list_workflow: tool({
            description: "List up to 100 workflows belonging to the authenticated user. Returns workflow IDs, titles, timestamps, graph counts, and latest run status; no workflow configuration or credentials.",
            inputSchema: z.object({}),
            execute: async () => {
                try { return (await listWorkflows(userId)).slice(0, MAX_TOOL_ITEMS); }
                catch (error) { return safeToolError(error); }
            },
        }),
        get_workflow: tool({
            description: "Get one workflow owned by the authenticated user. Returns its bounded graph and action/trigger labels, excluding raw metadata and secrets.",
            inputSchema: workflowIdInputSchema,
            execute: async ({ workflowId }) => {
                try { return workflowSummary(await getWorkflow(userId, workflowId)); }
                catch (error) { return safeToolError(error); }
            },
        }),
        list_available_actions,
        list_available_triggers,
        list_node_types,
        validate_workflow,
        create_workflow: tool({
            description: "Create a workflow for the authenticated user after validating its configuration. Returns a bounded workflow summary and webhook endpoint count.",
            inputSchema: createWorkflowInputSchema,
            execute: async (input) => {
                try { return workflowSummary(await createWorkflow(userId, input)); }
                catch (error) { return safeToolError(error); }
            },
        }),
        update_workflow: tool({
            description: "Update a workflow owned by the authenticated user after validating the supplied fields. Returns a bounded workflow summary.",
            inputSchema: updateWorkflowInputSchema,
            execute: async (input) => {
                try { return workflowSummary(await updateWorkflow(userId, input)); }
                catch (error) { return safeToolError(error); }
            },
        }),
        execute_workflow: tool({
            description: "Queue a new execution for a workflow owned by the authenticated user. Each call creates a separate run; supports a full manual run, one node, or a configured cron/webhook trigger. Returns only the run ID, workflow ID, and status.",
            inputSchema: executeWorkflowInputSchema,
            execute: async (input) => {
                try {
                    await assertWorkflowOwned(userId, input.workflowId);
                    const run = await executeWorkflow(userId, input);
                    return { runId: run.id, workflowId: input.workflowId, status: run.status };
                } catch (error) { return safeToolError(error); }
            },
        }),
        delete_workflow: tool({
            description: "Permanently delete a workflow owned by the authenticated user. Requires a separate server-side ownership check and returns a success result.",
            inputSchema: workflowIdInputSchema,
            execute: async ({ workflowId }) => {
                try {
                    await assertWorkflowOwned(userId, workflowId);
                    await deleteWorkflow(userId, workflowId);
                    return { success: true, workflowId };
                } catch (error) { return safeToolError(error); }
            },
        }),
        list_credentials: tool({
            description: "List up to 100 saved credentials belonging to the authenticated user. Returns IDs, titles, platforms, and timestamps only; secret values are never returned.",
            inputSchema: z.object({}),
            execute: async () => {
                try {
                    const credentials = await prisma.credentials.findMany({
                        where: { userId },
                        take: MAX_TOOL_ITEMS,
                        select: { id: true, title: true, platform: true, createdAt: true, updatedAt: true },
                        orderBy: { updatedAt: "desc" },
                    });
                    return credentials.map(({ id, title, platform, createdAt, updatedAt }) => ({
                        id, title, platform, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString(),
                    }));
                } catch (error) { return safeToolError(error); }
            },
        }),
    };
}
