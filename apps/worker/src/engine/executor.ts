import { NodeStatus, prisma, WorkflowStatus } from "@WorkOrchestrator/prisma";
import { NodeExecutionOutput, NodeRun, WorkflowEdge, WorkflowNode } from "./types";
import { executeNode } from "./nodeExecutor";
import { getMainRedisClient } from "@WorkOrchestrator/shared/redis";

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

type EdgeActivation="active"|"inactive"

interface BatchResult {
    nodeId: string;
    success: boolean;
    error?: Error;
}
interface TriggerSelectionResult {
    startNodeIds: string[];
    error: string | null;
}
interface NodeRunOutputRow {
    nodeId: string;
    status: NodeStatus;
    output: unknown;
}
const TRIGGER_TYPES = new Set([
    "triggerNode",
    "manualTrigger",
    "webhookTrigger",
    "cronTrigger",
]);

const redis=getMainRedisClient()

function isTriggerNode(node:WorkflowNode):boolean{
    return TRIGGER_TYPES.has(node.type)
}

function isManualTriggerNode(node: WorkflowNode): boolean {
    return node.type === "manualTrigger" || node.type === "triggerNode";
}

function isNodeActive(node:WorkflowNode):boolean{
    const data=node.data as Record<string,unknown>
    return data.isActive!==false
}

function getWorkflowRunSource(metadata: unknown): string | null {
    if (!metadata && typeof metadata!=="object"){
        return null
    }
    const source=(metadata as {source?:unknown}).source
    return typeof source === "string" ? source : null;
}

function isBypassedSkipOutput(output: unknown): output is {
    bypassed: true;
    passthrough?: unknown;
} {
    return Boolean(
        output &&
        typeof output === "object" &&
        (
            output as {
                bypassed?: unknown;
            }
        ).bypassed === true,
    );
}

function getConditionDefaultRoute(node: WorkflowNode): string {
    if (node.type!=="conditionNode"){
        return "default"
    }
    return typeof node.data.defaultRoute === "string" &&
        node.data.defaultRoute.trim().length > 0
        ? node.data.defaultRoute.trim()
        : "default";
}

function buildBypassedNodeOutput(node:WorkflowNode,
    incomingByTarget:Map<string,WorkflowEdge[]>,
    EdgeActivation:Map<string,EdgeActivation>,
    nodeById:Map<string,WorkflowNode>,
    outputByNodeId:Map<string,unknown>
): {
    skipped: true;
    bypassed: true;
    reason: string;
    passthrough: unknown;
} {
    const incomingEdges=incomingByTarget.get(node.id)??[]
    const upstreamOutput:Array<[string,unknown]>=[]

    for (const edge of incomingEdges){
        const activation=EdgeActivation.get(edge.source)??"active"
        if (activation!=="active"){
            continue
        }
        const nodeSource=nodeById.get(edge.source)
        if (!nodeSource || !isNodeActive(nodeSource)){
            continue
        }
        if (!outputByNodeId.has(edge.source)){
            continue
        }
        upstreamOutput.push([edge.source,outputByNodeId.get(edge.source)])
    }

    let passthrough:unknown=[]

    if (upstreamOutput.length === 1) {
        passthrough = upstreamOutput[0]?.[1] ?? {};
    } else if (upstreamOutput.length > 1) {
        passthrough = Object.fromEntries(upstreamOutput);
    }

    return {
        skipped: true,
        bypassed: true,
        reason: "Node is deactivated",
        passthrough,
    };
}

function getTargetNodeId(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== "object") {
        return null;
    }
    const source=(metadata as {
        source?:unknown
    }).source

    if (source !== "manual-node") {
        return null;
    }
    const nodeId = (
        metadata as {
            nodeId?: unknown;
        }
    ).nodeId;
    return typeof nodeId === "string" && nodeId.length > 0 ? nodeId : null;
}

async function getNodeRunsMinimal(workflowRunId: string): Promise<NodeRun[]> {
    const runs=await prisma.nodeRun.findMany({
        where:{workflowRunId},
        select:{
            id: true,
            nodeId: true,
            status: true,
            retryCount: true,
            output: true,
        }
    })

    return runs.map(
        (run: (typeof runs)[number]): NodeRun =>
            ({
                id: run.id,
                nodeId: run.nodeId,
                status: run.status,
                retryCount: run.retryCount,
                output: run.output as NodeRun["output"],
            }) as NodeRun,
    );
}

async function executSingleNode(workflowRunId: string,
    node: WorkflowNode,
    nodeRuns: NodeRun[],
    nodeById: Map<string, WorkflowNode>,
    ownerUserId: string,
): Promise<BatchResult> {
    try {
        await executeNode(workflowRunId,node,nodeRuns,ownerUserId,nodeById)
        return { nodeId: node.id, success: true };
    } catch (error) {
        console.error(
            `[${WORKER_ID}] Node ${node.id} (${node.type}) failed:`,
            error,
        );
        return {
            nodeId: node.id,
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}

//check if current node can run, return true if all active sources are completed
function canExecuteNode(
    node: WorkflowNode,
    incomingByTarget: Map<string, WorkflowEdge[]>,
    edgeActivation: Map<string, EdgeActivation>,
    completedNodeIds: Set<string>,
    failedNodeIds: Set<string>,
    nodeById: Map<string, WorkflowNode>,
): boolean {
    const incomingEdges=incomingByTarget.get(node.id)??[]
    if (incomingEdges.length===0){
        return true
    }

    let hasActiveDependency = false;

    for (const edge of incomingEdges){
        const sourceNode=nodeById.get(edge.source)
        if(!sourceNode){
            continue
        }

        if (sourceNode.type==="conditionNode" && !edgeActivation.has(edge.id) && !completedNodeIds.has(edge.source)){
            return false
        }
        const activation = edgeActivation.get(edge.id) ?? "active";
        if (activation === "inactive") {
            continue;
        }
        hasActiveDependency = true;
        if (failedNodeIds.has(edge.source)) {
            return false;
        }
        if (!completedNodeIds.has(edge.source)) {
            return false;
        }
    }
    return hasActiveDependency;
}


//skips current node if all of its sources are skipped or it is in not selected condition route
function shouldSkipNode(
    node: WorkflowNode,
    incomingByTarget: Map<string, WorkflowEdge[]>,
    edgeActivation: Map<string, EdgeActivation>,
    completedNodeIds: Set<string>,
    failedNodeIds: Set<string>,
    skippedNodeIds: Set<string>,
    nodeById: Map<string, WorkflowNode>,
): boolean {
    const incomingEdges = incomingByTarget.get(node.id) ?? []
    if (incomingEdges.length === 0) {
        return true
    }

    const activeSources:string[]=[]

    for (const edge of incomingEdges){
        const sourceNode = nodeById.get(edge.source)
        if (!sourceNode) {
            continue
        }

        const sourceResolved=(completedNodeIds.has(sourceNode.id)||skippedNodeIds.has(sourceNode.id)||failedNodeIds.has(sourceNode.id))

        if(!sourceResolved){
            const conditionEdgePending=sourceNode.type==="conditionNode" && edgeActivation.get(edge.id)
            if (!conditionEdgePending){
                return false
            }
        }

        const activation = edgeActivation.get(edge.id) ?? "active";
        if (activation === "active") {
            activeSources.push(edge.source);
        }
    }
    if (activeSources.length === 0) {
        return true;
    }
    return activeSources.every((sourceId) => skippedNodeIds.has(sourceId));
}

async function markNodeSkipped(
    workflowRunId: string,
    node: WorkflowNode,
    output?: unknown,
): Promise<void> {
    const skipOutput = output ?? {
        skipped: true,
        reason: "Path not selected by routing logic",
    };

    const existing = await prisma.nodeRun.findFirst({
        where: {
            workflowRunId,
            nodeId: node.id,
        },
    });

    if (existing) {
        await prisma.nodeRun.update({
            where: { id: existing.id },
            data: {
                status: NodeStatus.Skipped,
                completedAt: new Date(),
                output: skipOutput,
            },
        });
    } 
    else {
        await prisma.nodeRun.create({
            data: {
                workflowRunId,
                nodeId: node.id,
                nodeType: node.type,
                status: NodeStatus.Skipped,
                retryCount: 0,
                startedAt: new Date(),
                completedAt: new Date(),
                output: skipOutput,
            },
        });
    }
    redis.publish(`workflow-run:${workflowRunId}`,
        JSON.stringify({
            type: "node",
            nodeId: node.id,
            status: "Skipped",
            nodeType: node.type,
            timestamp: Date.now(),
        }),
    )
        .catch(() => { });
}

function extractSelectedRoute(output: unknown): string {
    if (!output || typeof output !== "object") {
        return "default";
    }
    const routeValue = (
        output as {
            route?: unknown;
        }
    ).route;
    if (typeof routeValue === "string" && routeValue.trim().length > 0) {
        return routeValue;
    }
    const routesValue = (
        output as {
            routes?: unknown;
        }
    ).routes;
    if (Array.isArray(routesValue) && typeof routesValue[0] === "string") {
        return routesValue[0];
    }
    return "default";
}

function applyConditionEdgeActivation(
    node: WorkflowNode,
    output: unknown,
    outgoingEdges: WorkflowEdge[],
    edgeActivation: Map<string, EdgeActivation>,
): void {
    if (node.type!=="conditionNode"){
        return
    }

    const selectedRoute=extractSelectedRoute(output)
    
    const nodeDefaultRoute =typeof node.data.defaultRoute === "string" &&
            node.data.defaultRoute.trim().length > 0
            ? node.data.defaultRoute.trim()
            : "default";
    
    for (const edge of outgoingEdges) {
        const dataRoute =
            typeof edge.data?.route === "string" ? edge.data.route : undefined;
        const edgeRoute = edge.sourceHandle ?? dataRoute ?? nodeDefaultRoute;
        edgeActivation.set(
            edge.id,
            edgeRoute === selectedRoute ? "active" : "inactive",
        );
    }
}

async function getNodeRunOutputs(
    workflowRunId: string,
    nodeIds: string[],
): Promise<NodeRunOutputRow[]> {
    if (nodeIds.length === 0) {
        return [];
    }
    const rows = await prisma.nodeRun.findMany({
        where: {
            workflowRunId,
            nodeId: { in: nodeIds },
        },
        select: {
            nodeId: true,
            status: true,
            output: true,
        },
    });
    return rows.map((row) => ({
        nodeId: row.nodeId,
        status: row.status,
        output: row.output,
    }));
}

function determineFinalStatus(
    totalNodes: number,
    completedCount: number,
    failedCount: number,
    skippedCount: number,
): WorkflowStatus {
    if (failedCount > 0) {
        return WorkflowStatus.Failure;
    }
    if (completedCount + skippedCount === totalNodes) {
        return WorkflowStatus.Success;
    }
    return WorkflowStatus.Failure;
}

async function updateWorkflowStatus(
    workflowRunId: string,
    status: WorkflowStatus,
): Promise<void> {
    await prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: {
            status,
            finishedAt: new Date(),
        },
    });
    redis
        .publish(
            `workflow-run:${workflowRunId}`,
            JSON.stringify({
                type: "workflow",
                status: status.toString(),
                timestamp: Date.now(),
            }),
        )
        .catch(() => { });
}

function selectTriggerEntryNodes(
    metadata: unknown,
    nodes: WorkflowNode[],
): TriggerSelectionResult {
    const activeTriggerNodeIds=nodes.filter((node)=>isTriggerNode(node) && isNodeActive(node)).map((node)=>node.id)

    if (!metadata || typeof metadata !== "object") {
        return {
            startNodeIds: activeTriggerNodeIds,
            error: null,
        };
    }
    const source = (
        metadata as {
            source?: unknown;
        }
    ).source;
    const nodeId = (
        metadata as {
            nodeId?: unknown;
        }
    ).nodeId;

    if (source === "manual") {
        const manualTriggerNodeIds = nodes
            .filter((node) => isManualTriggerNode(node) && isNodeActive(node))
            .map((node) => node.id);
        if (manualTriggerNodeIds.length === 0) {
            return {
                startNodeIds: [],
                error:
                    "Manual execution requires an active manual trigger node. Use webhook URL or cron schedule for non-manual workflows.",
            };
        }
        return {
            startNodeIds: manualTriggerNodeIds,
            error: null,
        };
    }
    if (source === "webhook" || source === "cron") {
        if (typeof nodeId !== "string" || nodeId.length === 0) {
            return {
                startNodeIds: [],
                error: `${source} execution is missing trigger node context.`,
            };
        }
        const matching = nodes.find((node) => node.id === nodeId);
        const expectedType =
            source === "webhook" ? "webhookTrigger" : "cronTrigger";
        if (!matching) {
            return {
                startNodeIds: [],
                error: `${source} trigger node ${nodeId} was not found.`,
            };
        }
        if (matching.type !== expectedType) {
            return {
                startNodeIds: [],
                error: `${source} run expected ${expectedType} but received ${matching.type} for node ${nodeId}.`,
            };
        }
        if (!isNodeActive(matching)) {
            return {
                startNodeIds: [],
                error: `${source} trigger node ${nodeId} is deactivated.`,
            };
        }
        return {
            startNodeIds: [nodeId],
            error: null,
        };
    }
    if (source === "manual-node") {
        return {
            startNodeIds: [],
            error: "Manual-node execution requires a target node context.",
        };
    }
    return {
        startNodeIds: activeTriggerNodeIds,
        error: null,
    };
}