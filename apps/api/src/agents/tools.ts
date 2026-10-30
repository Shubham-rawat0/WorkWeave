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

const agentNodeSchema = z.object({
    id: z.string().trim().min(1).max(100),
    type: z.string().trim().min(1).max(100),
    data: z.record(z.string(), z.any()).default({}),
}).loose();

const agentEdgeSchema = z.object({
    source: z.string().trim().min(1).max(100),
    target: z.string().trim().min(1).max(100),
    sourceHandle: z.string().nullable().optional(),
    targetHandle: z.string().nullable().optional(),
}).loose();

// Gemini rejects recursive JSON schemas for tool arguments. Keep the model-facing
// schemas shallow, then validate the full JSON values with the workflow schemas
// before calling the services.
const agentCreateWorkflowInputSchema = z.object({
    id: createWorkflowInputSchema.shape.id,
    title: createWorkflowInputSchema.shape.title,
    availableTriggerId: createWorkflowInputSchema.shape.availableTriggerId,
    triggerMetadata: z.any(),
    actions: z.array(z.object({
        id: createWorkflowInputSchema.shape.actions.element.shape.id,
        availableActionId: createWorkflowInputSchema.shape.actions.element.shape.availableActionId,
        metadata: z.any(),
    })),
    nodes: z.array(agentNodeSchema).max(200),
    edges: z.array(agentEdgeSchema).max(500),
});

const agentUpdateWorkflowInputSchema = z.object({
    id: updateWorkflowInputSchema.shape.id,
    title: updateWorkflowInputSchema.shape.title,
    nodes: z.array(agentNodeSchema).max(200).optional(),
    edges: z.array(agentEdgeSchema).max(500).optional(),
    triggerMetadata: z.any().optional(),
    actions: z.array(z.object({
        id: z.string().min(1).max(100),
        availableActionId: z.string().min(1).max(100),
        metadata: z.any(),
    })).max(200).optional(),
}).refine(
    (data) => data.title !== undefined || data.nodes !== undefined || data.edges !== undefined ||
        data.triggerMetadata !== undefined || data.actions !== undefined,
    { message: "At least one field must be provided to update" },
);

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

function verifyAgentWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
    const issues: Array<{ type: "error" | "warning"; message: string; nodeIds?: string[]; suggestion?: string }> = [];
    const graphErrors = validateWorkflowGraph(nodes, edges);
    for (const message of graphErrors) {
        issues.push({ type: "error", message, suggestion: "Fix the node IDs and edge endpoints before saving." });
    }

    const triggerTypes = new Set(["triggerNode", "manualTrigger", "webhookTrigger", "cronTrigger"]);
    const registeredNodeTypes = new Set([...NODE_REGISTRY.map((node) => node.type), "triggerNode"]);
    for (const node of nodes) {
        if (!registeredNodeTypes.has(node.type)) {
            issues.push({
                type: "error",
                message: `Node "${node.id}" uses unknown type "${node.type}".`,
                nodeIds: [node.id],
                suggestion: "Use an exact type returned by list_node_types.",
            });
        }
    }
    const triggers = nodes.filter((node) => triggerTypes.has(node.type));
    const actionNodes = nodes.filter((node) => !triggerTypes.has(node.type));
    for (const node of nodes.filter((candidate) => candidate.type === "manualTrigger" || candidate.type === "triggerNode")) {
        const data = node.data && typeof node.data === "object" ? node.data : {};
        const misplacedPayloadFields = Object.keys(data).filter((key) => key !== "payload" && key !== "isActive" && key !== "isConfigured");
        if (misplacedPayloadFields.length > 0) {
            issues.push({
                type: "error",
                message: `Manual trigger "${node.id}" has input fields outside data.payload: ${misplacedPayloadFields.join(", ")}.`,
                nodeIds: [node.id],
                suggestion: "Put runtime input under data.payload, for example data: { payload: { age: 20 } }. Top-level fields and triggerMetadata are not passed to downstream nodes.",
            });
        }
    }
    if (triggers.length === 0) {
        issues.push({ type: "error", message: "The graph has no trigger node.", suggestion: "Add a manualTrigger, webhookTrigger, or cronTrigger node." });
    }
    if (actionNodes.length === 0) {
        issues.push({ type: "error", message: "The graph has a trigger but no action or processing nodes.", suggestion: "Add the node that performs the requested work, then connect it to the trigger." });
    }

    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();
    for (const edge of edges) {
        const targets = outgoing.get(edge.source) ?? [];
        targets.push(edge.target);
        outgoing.set(edge.source, targets);
        const sources = incoming.get(edge.target) ?? [];
        sources.push(edge.source);
        incoming.set(edge.target, sources);
    }
    const reachable = new Set<string>();
    const queue = triggers.map((node) => node.id);
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || reachable.has(current)) continue;
        reachable.add(current);
        queue.push(...(outgoing.get(current) ?? []));
    }
    const disconnected = actionNodes.filter((node) => !reachable.has(node.id));
    if (disconnected.length > 0) {
        issues.push({
            type: "error",
            message: `${disconnected.length} action/processing node(s) cannot be reached from a trigger.`,
            nodeIds: disconnected.map((node) => node.id),
            suggestion: "Connect the trigger to the first node and connect each later node into the same flow.",
        });
    }
    if (actionNodes.length > 0 && triggers.every((node) => !(outgoing.get(node.id)?.length))) {
        issues.push({ type: "error", message: "No edge leaves the trigger node.", suggestion: "Add an edge from the trigger to the first action/processing node." });
    }

    const knownTemplateRoots = new Set([
        ...nodes.map((node) => node.id),
        ...nodes.map((node) => typeof node.data?.responseName === "string" ? node.data.responseName : ""),
        "ai", "openai", "anthropic", "gemini",
    ]);
    for (const node of nodes.filter((candidate) => candidate.type === "logNode")) {
        const message = typeof node.data?.message === "string" ? node.data.message : "";
        const incomingNodeIds = incoming.get(node.id) ?? [];
        const allowedRoots = new Set(knownTemplateRoots);
        if (incomingNodeIds.length === 1) allowedRoots.add("previousNode");
        for (const match of message.matchAll(/\{\{\s*(?:json\s+)?([A-Za-z0-9_-]+)/g)) {
            const root = match[1];
            if (root && !allowedRoots.has(root)) {
                issues.push({
                    type: "error",
                    message: `Log node "${node.id}" references unknown output "${root}".`,
                    nodeIds: [node.id],
                    suggestion: incomingNodeIds.length === 1
                        ? `Use {{previousNode.field}} or {{${incomingNodeIds[0]}.field}} for the connected node's output.`
                        : "Use an existing node ID or responseName as the template root.",
                });
            }
        }
    }

    const validation = validateWorkflow(nodes, edges);
    issues.push(...validation.issues.map((issue) => ({
        type: issue.type,
        message: issue.message,
        ...(issue.nodeIds ? { nodeIds: issue.nodeIds } : {}),
        ...(issue.suggestion ? { suggestion: issue.suggestion } : {}),
    })));
    const uniqueIssues = issues.filter((issue, index) =>
        issues.findIndex((candidate) => candidate.message === issue.message) === index,
    );
    const hasErrors = uniqueIssues.some((issue) => issue.type === "error");
    return {
        readyToSave: !hasErrors,
        canExecute: validation.canExecute && !hasErrors,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        triggerCount: triggers.length,
        actionNodeCount: actionNodes.length,
        issues: uniqueIssues.slice(0, MAX_TOOL_ITEMS),
    };
}

const NODE_CONFIGURATION_GUIDANCE: Record<string, string> = {
    manualTrigger: "data: { payload: { <inputName>: <value> } }; runtime input must be nested under payload",
    webhookTrigger: "data: { isActive: true }",
    cronTrigger: "data: { isActive: true, cronExpression: <schedule> }",
    httpTrigger: "data: { url: <URL>, method: <HTTP method> }",
    openaiNode: "data: { credentialId, model, prompt } (or inputMode: 'json', requestJson)",
    aiNode: "data: { credentialId, model, prompt } (or inputMode: 'json', requestJson)",
    geminiNode: "data: { credentialId, model, prompt } (or inputMode: 'json', requestJson)",
    anthropicNode: "data: { credentialId, model, prompt } (or inputMode: 'json', requestJson)",
    githubNode: "data: { credentialId, owner, repo, operation, title } for create_issue; issueNumber/body for comment; issueNumber for get_issue",
    notionNode: "data: { credentialId, operation, dataSourceId or databaseId, propertiesTemplate } for create; pageId for get/update",
    slackNode: "data: { message }",
    telegramNode: "data: { credentialId, chatId, message }",
    conditionNode: "data: { expression, routes: [...] }",
    filterNode: "data: { expression }",
    transformNode: "data: { expression }",
    delayNode: "data: { durationMs: positive number }",
    logNode: "data: { message: 'Value: {{previousNode.field}}' }; use previousNode to read the directly connected node's output",
};

const list_available_triggers = tool({
    description: "List up to 100 available trigger types for configuring a workflow. Returns only each trigger's ID and display name.",
    inputSchema: z.object({}),
    execute: async () => {
        return await prisma.availableTrigger.findMany({
            take: MAX_TOOL_ITEMS,
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
            take: MAX_TOOL_ITEMS,
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
            },
        })
    }
})

const list_node_types = tool({
    description: "Get registered workflow node types and the required data fields for each. Use the exact type string in each graph node's type field.",
    inputSchema: z.object({
        category: z.enum(["triggers", "utilities", "integrations", "logic"]).optional()
    }),
    execute: ({ category }: { category?: NodeCategory }) => {
        if (category) {
            return getNodesByCategory()[category].map((node) => ({ ...node, configuration: NODE_CONFIGURATION_GUIDANCE[node.type] ?? "data: {}" }))
        }
        return NODE_REGISTRY.map((node) => ({ ...node, configuration: NODE_CONFIGURATION_GUIDANCE[node.type] ?? "data: {}" }))
    }
})


const validate_workflow = tool({
    description: "Check node configuration and graph structure without saving. For a full creation check that requires a trigger, at least one action node, and connected paths, use verify_workflow.",
    inputSchema: z.object({
        nodes: z.array(z.object({
            id: z.string().trim().min(1),
            type: z.string().trim().min(1),
            data: z.record(z.string(), z.any()).default({}),
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

const verify_workflow = tool({
    description: "Verify a complete proposed workflow before create_workflow or update_workflow. Requires at least one trigger node, at least one non-trigger node, and every non-trigger node reachable from a trigger through source/target edges. Returns readyToSave and specific fixes. Call this immediately before saving; do not save when readyToSave is false.",
    inputSchema: z.object({
        nodes: z.array(agentNodeSchema).max(200),
        edges: z.array(agentEdgeSchema).max(500),
    }),
    execute: ({ nodes, edges }) => verifyAgentWorkflow(nodes as WorkflowNode[], edges as WorkflowEdge[]),
});

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
        verify_workflow,
        create_workflow: tool({
            description: "Create a workflow for the authenticated user. Supply the canvas graph explicitly: nodes with id/type/data and edges with source/target. It must contain a trigger node, at least one requested action/processing node, and connected paths. The database trigger record alone does not create a canvas node. The tool blocks trigger-only, empty, and disconnected graphs. Returns a bounded workflow summary and webhook endpoint count.",
            inputSchema: agentCreateWorkflowInputSchema,
            execute: async (input) => {
                try {
                    const validated = createWorkflowInputSchema.parse(input);
                    const verification = verifyAgentWorkflow(validated.nodes as unknown as WorkflowNode[], validated.edges as unknown as WorkflowEdge[]);
                    if (!verification.readyToSave) {
                        return { error: { code: "INVALID_WORKFLOW_GRAPH", message: "Workflow was not saved because verification found issues.", verification } };
                    }
                    return workflowSummary(await createWorkflow(userId, validated));
                }
                catch (error) { return safeToolError(error); }
            },
        }),
        update_workflow: tool({
            description: "Update a workflow owned by the authenticated user. When changing its canvas graph, supply nodes with id/type/data and edges with source/target; the graph must include a trigger, at least one action/processing node, and connected paths. Returns a bounded workflow summary.",
            inputSchema: agentUpdateWorkflowInputSchema,
            execute: async (input) => {
                try {
                    const validated = updateWorkflowInputSchema.parse(input);
                    if (validated.nodes || validated.edges) {
                        const existing = await getWorkflow(userId, validated.id);
                        const nodes = (validated.nodes ?? existing.workflow.nodes) as unknown as WorkflowNode[];
                        const edges = (validated.edges ?? existing.workflow.edges) as unknown as WorkflowEdge[];
                        const verification = verifyAgentWorkflow(nodes, edges);
                        if (!verification.readyToSave) {
                            return { error: { code: "INVALID_WORKFLOW_GRAPH", message: "Workflow was not updated because verification found issues.", verification } };
                        }
                    }
                    return workflowSummary(await updateWorkflow(userId, validated));
                }
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
