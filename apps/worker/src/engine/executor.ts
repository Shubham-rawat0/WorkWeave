import { NodeStatus, prisma, WorkflowStatus } from "@WorkOrchestrator/prisma";
import {  NodeRun, parseWorkflowEdges, parseWorkflowNodes, WorkflowEdge, WorkflowNode } from "./types";
import { executeNode } from "./nodeExecutor";
import { getMainRedisClient } from "@WorkOrchestrator/shared/redis";
import { acquireLock, LOCK_TTL_SECONDS, releaseLock, renewLock } from "./lock";
import { getReachableNodes, hasCycle } from "./graphUtils";

const WORKER_ID = `worker-${process.pid}`;

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
    if (!metadata || typeof metadata!=="object"){
        return null
    }
    const source=(metadata as {source?:unknown}).source
    return typeof source === "string" ? source : null;
}

// A skipped run is treated as completed only when it carries bypass
// passthrough data (deactivated node); plain skips halt their subtree.
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

// Route a bypassed condition node takes when it can't evaluate — the
// default edge is kept alive so deactivated conditions don't deadlock flows.
function getConditionDefaultRoute(node: WorkflowNode): string {
    if (node.type!=="conditionNode"){
        return "default"
    }
    return typeof node.data.defaultRoute === "string" &&
        node.data.defaultRoute.trim().length > 0
        ? node.data.defaultRoute.trim()
        : "default";
}

//This function builds a bypass output for a deactivated node. The node is marked as skipped, but its upstream output is passed through so downstream nodes can still access the data.
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

// Returns the run's target node id ONLY for `source: "manual-node"` — any
// other source (or malformed metadata) yields null and takes the full graph
// path via selectTriggerEntryNodes below.
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

// Runs a single node without touching the graph. Returns a BatchResult
// (never throws) so callers can mix node outcomes inside a batch Promise.all.
async function executeSingleNode(
    workflowRunId: string,
    node: WorkflowNode,
    nodeRuns: NodeRun[],
    nodeById: Map<string, WorkflowNode>,
    ownerUserId: string,
    incomingEdges: WorkflowEdge[],
): Promise<BatchResult> {
    try {
        await executeNode(
            workflowRunId,
            node,
            nodeRuns,
            ownerUserId,
            nodeById,
            incomingEdges,
        )
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
        return false
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

// Idempotent: reuse the node's existing nodeRun row if one exists from a
// previous attempt, so skip records survive run recovery.
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

// Condition nodes may report the chosen route as `route` or as the first
// entry of `routes`; anything else falls back to the node's default route.
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

    //selected route by the node based on logic
    const selectedRoute=extractSelectedRoute(output)
    
    const nodeDefaultRoute =typeof node.data.defaultRoute === "string" &&
            node.data.defaultRoute.trim().length > 0
            ? node.data.defaultRoute.trim()
            : "default";
    
    for (const edge of outgoingEdges) {
        const dataRoute =
            typeof edge.data?.route === "string" ? edge.data.route : undefined;
        const edgeRoute = edge.sourceHandle ?? dataRoute ?? nodeDefaultRoute;

        //set un selected outgoing edges as inactive
        edgeActivation.set(
            edge.id,
            edgeRoute === selectedRoute ? "active" : "inactive",
        );
    }
}

// Fetches outputs for exactly the nodes that just succeeded in the previous
// batch — needed to activate condition edges and feed downstream inputs.
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

// Final status: any failure fails the run; otherwise success requires every
// reachable node to have been either completed or (any kind of) skipped.
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

// Chooses the entry points for a full run from the run's recorded source:
// "manual" → all active manual triggers; "webhook"/"cron" → exactly the
// referenced trigger, with type/active/configured revalidated (the API's
// verdict may be stale by the time the worker picks the job up).
function selectTriggerEntryNodes(
    metadata: unknown,
    nodes: WorkflowNode[],
): TriggerSelectionResult {
    const activeTriggerNodeIds=nodes.filter((node)=>{
        if (!isTriggerNode(node) || !isNodeActive(node)) return false;
        const data = node.data as Record<string, unknown>;
        return (node.type === "webhookTrigger" || node.type === "cronTrigger")
            ? data.isConfigured === true
            : true;
    }).map((node)=>node.id)

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
        const triggerData = matching.data as Record<string, unknown>;
        if (triggerData.isConfigured !== true) {
            return {
                startNodeIds: [],
                error: `${source} trigger node ${nodeId} is not configured.`,
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

export async function executeWorkflow(workflowRunId: string): Promise<void> {
    const lockAcquired=await acquireLock(WORKER_ID,workflowRunId)

    if(!lockAcquired){
        console.log(`[${WORKER_ID}] could not acquire lock for ${workflowRunId}`)
    return 
    }

    const lockHeartbeatIntervalMs = Math.max(
        1000,
        Math.floor((LOCK_TTL_SECONDS * 1000) / 2),
    );

    // Heartbeat at half the TTL so long workflows never lose the lock
    // (and a crashed worker's lock expires on its own).
    const lockHeartbeat=setInterval(()=>{
        renewLock(WORKER_ID,workflowRunId).catch((error)=>{
            console.error(
                `[${WORKER_ID}] Failed to renew lock for ${workflowRunId}:`,
                error,
            );
        })
    },lockHeartbeatIntervalMs)

try {
        // CAS: only claim Pending/Running runs. A run cancelled while queued
        // (or already finalized elsewhere) is silently skipped here.
        const started = await prisma.workflowRun.updateMany({
            where: {
                id: workflowRunId,
                status: { in: [WorkflowStatus.Pending, WorkflowStatus.Running] },
            },
            data: { status: WorkflowStatus.Running },
        });
        if (started.count === 0) {
            return;
        }
        redis.publish(
            `workflow-run:${workflowRunId}`,
            JSON.stringify({
                type: "workflow",
                status: WorkflowStatus.Running.toString(),
                timestamp: Date.now(),
            }),
        ).catch(() => { });

        const workflowRun = await prisma.workflowRun.findUnique({
            where: { id: workflowRunId },
            include: {
                workflow: true,
                nodeRuns: true,
            },
        });
        if (!workflowRun) {
            throw new Error(`Workflow run ${workflowRunId} not found`);
        }

        const ownerUserId = workflowRun.workflow.userId;
        if (!ownerUserId) {
            throw new Error(
                `Workflow ${workflowRun.workflow.id} has no owner user id`,
            );
        }

        const nodes=parseWorkflowNodes(workflowRun.workflow.nodes)
        const edges= parseWorkflowEdges(workflowRun.workflow.edges)

        //find node id, if user is running only a single node
        const targetNodeId=getTargetNodeId(workflowRun.metadata)
        const workflowRunSource=getWorkflowRunSource(workflowRun.metadata)

        const allNodesById=new Map(nodes.map((node)=>[node.id,node]))
        // Single-node fast path: `source: "manual-node"` runs execute ONLY
        // the target node — no graph traversal, no downstream. Incoming edges
        // exist purely to assemble its input from prior run outputs, and the
        // run completes right after this one node succeeds or fails.
        if (targetNodeId){
            const targetNode = nodes.find((node) => node.id === targetNodeId);
            if (!targetNode) {
                throw new Error(`Target node ${targetNodeId} not found in workflow`);
            }
            
            if (!isNodeActive(targetNode)) {
                throw new Error(`Target node ${targetNodeId} is deactivated`);
            }

            console.log(`[${WORKER_ID}] Executing single node ${targetNodeId}`);
            const currentNodeRuns = await getNodeRunsMinimal(workflowRunId);

            const result = await executeSingleNode(
                workflowRunId,
                targetNode,
                currentNodeRuns,
                allNodesById,
                ownerUserId,
                edges.filter((edge) => edge.target === targetNode.id),
            );
            await updateWorkflowStatus(
                workflowRunId,
                result.success ? WorkflowStatus.Success : WorkflowStatus.Failure,
            );
            return;
        }


        if(nodes.length===0){
            await updateWorkflowStatus(workflowRunId, WorkflowStatus.Success);
            console.log(`Workflow ${workflowRunId} has no nodes, marking complete`);
            return;
        }

        if(hasCycle(nodes,edges)){
            throw new Error(
                "Circular dependency detected in workflow. Cannot execute.",
            );
        }

        const triggerNodes=nodes.filter(isTriggerNode)
        const triggerSelection=selectTriggerEntryNodes(workflowRun.metadata,nodes)

        if(triggerSelection.error){
            throw new Error(triggerSelection.error)
        }

        const startNodeIds=triggerSelection.startNodeIds

        if (triggerNodes.length > 0 && startNodeIds.length === 0) {
            if (workflowRunSource === "manual") {
                throw new Error(
                    "No active manual trigger nodes found. Use webhook URL or cron schedule for this workflow, or add a manual trigger.",
                );
            }
            throw new Error(
                "All trigger nodes are deactivated. Activate at least one trigger node.",
            );
        }

        const reachableNodes=getReachableNodes(nodes,edges,startNodeIds)
        const reachableNodeIdSet=new Set(reachableNodes.map((node)=>node.id))

        const reachableEdges=edges.filter((edge)=>reachableNodeIdSet.has(edge.source) && reachableNodeIdSet.has(edge.target))

        const nodeById = new Map(reachableNodes.map((node) => [node.id, node]));

        const incomingByTarget = new Map<string, WorkflowEdge[]>();
        const outgoingBySource = new Map<string, WorkflowEdge[]>();

        for (const edge of reachableEdges){
            const incoming=incomingByTarget.get(edge.target)??[]
            incoming.push(edge)

            incomingByTarget.set(edge.target,incoming)

            const outgoing=outgoingBySource.get(edge.source)??[]
            outgoing.push(edge)
            outgoingBySource.set(edge.source,outgoing)
        }

        const completedNodeIds = new Set<string>();
        const failedNodeIds = new Set<string>();
        const skippedNodeIds = new Set<string>();
        const outputByNodeId = new Map<string, unknown>();

        const edgeActivation = new Map<string, EdgeActivation>();

        for (const edge of reachableEdges){
            const sourceNode=nodeById.get(edge.source)
            if (sourceNode?.type!=="conditionNode"){
                edgeActivation.set(edge.id,"active")
            }
        }

        // Seed state from previous node runs (resumable replay): successful
        // nodes keep their outputs, bypassed "skips" count as completed so
        // their passthrough data still flows downstream.
        for (const nodeRun of workflowRun.nodeRuns){
            if (!reachableNodeIdSet.has(nodeRun.nodeId)){
                continue
            }

            if (nodeRun.status===NodeStatus.Success){
                completedNodeIds.add(nodeRun.nodeId)

                if (nodeRun.output !== null && nodeRun.output !== undefined) {
                    outputByNodeId.set(nodeRun.nodeId, nodeRun.output);
                }
            }
            else if (nodeRun.status===NodeStatus.Skipped){

                if (isBypassedSkipOutput(nodeRun.output)){
                    completedNodeIds.add(nodeRun.nodeId)
                    outputByNodeId.set(nodeRun.nodeId,nodeRun.output)
                }
                else{
                    skippedNodeIds.add(nodeRun.nodeId);
                }
            }

            else if (nodeRun.status===NodeStatus.Failed && nodeRun.retryCount>=3){
                failedNodeIds.add(nodeRun.nodeId)
            }
        }

        for (const node of reachableNodes){
            if (node.type!=="conditionNode" || !completedNodeIds.has(node.id)){
                continue
            }
            applyConditionEdgeActivation(node,outputByNodeId.get(node.id),outgoingBySource.get(node.id)??[],edgeActivation)
        }

        let batchNumber=0
        // Batch loop: run every node whose dependencies have resolved, then
        // re-evaluate. A failed node blocks its own subtree, which is why
        // final status is derived from the completed/skipped sets below.
        while (true){
            const pendingNodes=reachableNodes.filter((node)=>!completedNodeIds.has(node.id) && !failedNodeIds.has(node.id) && !skippedNodeIds.has(node.id))

            if (pendingNodes.length===0){
                break
            }

            //nodes whose all parent are skipped or inactive or in different condition logic route
            const nodesToSkip=pendingNodes.filter((node)=>shouldSkipNode(node,incomingByTarget,edgeActivation,completedNodeIds,failedNodeIds,skippedNodeIds,nodeById))
            
            if (nodesToSkip.length > 0) {
                for (const node of nodesToSkip) {
                    await markNodeSkipped(workflowRunId, node);
                    skippedNodeIds.add(node.id);
                }
            }

            //finds nodes to bypass(deactive nodes)
            const nodesToBypass = pendingNodes.filter(
                (node) =>
                    !skippedNodeIds.has(node.id) &&
                    !isNodeActive(node) &&
                    canExecuteNode(
                        node,
                        incomingByTarget,
                        edgeActivation,
                        completedNodeIds,
                        failedNodeIds,
                        nodeById,
                    ),
            );

            //if bypass nodes, build their output using upstream nodes for downstream nodes
            if (nodesToBypass.length > 0) {
                for (const node of nodesToBypass) {
                    const bypassOutput = buildBypassedNodeOutput(
                        node,
                        incomingByTarget,
                        edgeActivation,
                        nodeById,
                        outputByNodeId,
                    );

                    await markNodeSkipped(workflowRunId, node, bypassOutput);
                    completedNodeIds.add(node.id);
                    outputByNodeId.set(node.id, bypassOutput.passthrough);
                    if (node.type === "conditionNode") {
                        applyConditionEdgeActivation(
                            node,
                            { route: getConditionDefaultRoute(node) },
                            outgoingBySource.get(node.id) ?? [],
                            edgeActivation,
                        );
                    }
                }
            }

            //nodes which can execute together(currentbatch) and whose source are completed/skipped
            const nodesToExecute = pendingNodes.filter(
                (node) =>
                    !skippedNodeIds.has(node.id) &&
                    isNodeActive(node) &&
                    canExecuteNode(
                        node,
                        incomingByTarget,
                        edgeActivation,
                        completedNodeIds,
                        failedNodeIds,
                        nodeById,
                    ),
            );

            if (nodesToExecute.length === 0) {
                const unresolved = reachableNodes.filter(
                    (node) =>
                        !completedNodeIds.has(node.id) &&
                        !failedNodeIds.has(node.id) &&
                        !skippedNodeIds.has(node.id),
                );
                if (unresolved.length > 0) {
                    console.error(
                        `[${WORKER_ID}] Unresolved nodes remain with no executable/skippable path: ${unresolved
                            .map((node) => `${node.id}:${node.type}`)
                            .join(", ")}`,
                    );
                }
                break;
            }

            batchNumber+=1
            console.log(
                `[${WORKER_ID}] Batch ${batchNumber}: Executing ${nodesToExecute.length} node(s)`,
            );

            const currentNodeRuns=await getNodeRunsMinimal(workflowRunId)

            const results=await Promise.all(
                nodesToExecute.map((node)=>executeSingleNode(
                    workflowRunId,
                    node,
                    currentNodeRuns,
                    nodeById,
                    ownerUserId,
                    incomingByTarget.get(node.id) ?? [],
                ))
            )

            const succeededIds:string[]=[]

            for (const result of results){
                if (result.success) {
                    completedNodeIds.add(result.nodeId);
                    succeededIds.push(result.nodeId);
                } else {
                    failedNodeIds.add(result.nodeId);
                }
            }

            if (succeededIds.length>0){
                const successRows=await getNodeRunOutputs(workflowRunId,succeededIds)

                for (const row of successRows) {
                    if (row.status === NodeStatus.Success) {
                        outputByNodeId.set(row.nodeId, row.output);
                    }
                }

                for (const nodeId of succeededIds) {
                    const node = nodeById.get(nodeId);
                    if (!node || node.type !== "conditionNode") {
                        continue;
                    }
                    applyConditionEdgeActivation(
                        node,
                        outputByNodeId.get(node.id),
                        outgoingBySource.get(node.id) ?? [],
                        edgeActivation,
                    );
                }
            }
            const successCount = results.filter((result) => result.success).length;
            const failCount = results.length - successCount;
            console.log(
                `[${WORKER_ID}] Batch ${batchNumber} complete: ${successCount} success, ${failCount} failed`,
            );
        }

        const finalStatus = determineFinalStatus(reachableNodes.length, completedNodeIds.size, failedNodeIds.size, skippedNodeIds.size)
        await updateWorkflowStatus(workflowRunId,finalStatus)

        console.log(
            `[${WORKER_ID}] Workflow ${workflowRunId} finished: ${finalStatus} ` +
            `(success=${completedNodeIds.size}, skipped=${skippedNodeIds.size}, failed=${failedNodeIds.size})`,
        );
    } catch (error) {
        console.error(`[${WORKER_ID}] Workflow ${workflowRunId} failed:`, error);

        await prisma.workflowRun.update({
            where: { id: workflowRunId },
            data: {
                status: WorkflowStatus.Failure,
                finishedAt: new Date(),
                errorMetadata: {
                    message: error instanceof Error ? error.message : "Unknown error",
                    workerId: WORKER_ID,
                },
            },
        });

        redis.publish(
                `workflow-run:${workflowRunId}`,
                JSON.stringify({
                    type: "workflow",
                    status: "Failure",
                    error: error instanceof Error ? error.message : "Unknown error",
                    timestamp: Date.now(),
                }),
            ).catch(() => { });
        throw error;
    } finally{
        clearInterval(lockHeartbeat);
        const released = await releaseLock(WORKER_ID, workflowRunId);
        if (!released) {
            console.warn(
                `[${WORKER_ID}] Lock for ${workflowRunId} was not owned at release time`,
            );
        }
    }
}
