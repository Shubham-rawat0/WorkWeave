import type { WorkflowEdge, WorkflowNode } from "./types/nodes";

// Builds source -> [targets] adjacency; node with no edges maps to [].
export function buildAdjacency(nodes:WorkflowNode[], edges:WorkflowEdge[]):Map<string,string[]>{
    const graph=new Map<string,string[]>()
    for (const node of nodes){
        graph.set(node.id,[])
    }
    for (const edge of edges){
        const node=graph.get(edge.source)
        if (node) node.push(edge.target)
    }
    return graph;
}

export function calculateInDegree(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
): Map<string, number> {
    const inDeg=new Map<string,number>()

    for (const node of nodes){
        inDeg.set(node.id,0)
    }

    for (const edge of edges){
        const prev=inDeg.get(edge.source)||0
        if (prev){
            inDeg.set(edge.target,prev+1)
        }
    }
    return inDeg
}

// Colors the DFS stack (recursion + exit): hitting a node already "on the
// stack" means a cycle — visited nodes without it are merely cross branches.
export function hasCycle(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
): boolean {
    const graph=buildAdjacency(nodes,edges)
    const visited=new Set<string>()
    const stack=new Set<string>()
    function dfs(nodeId:string):boolean{
        if (stack.has(nodeId)){
            return true
        }
        stack.add(nodeId)
        visited.add(nodeId)
        const neighbours = graph.get(nodeId)||[]
        for (const nei of neighbours){
            if (!visited.has(nei)) {
                if (dfs(nei)) return true;
            } else if (stack.has(nei)) {
                return true;
            }
        }
        stack.delete(nodeId);
        return false
    } 
    for (const node of nodes) {
        if (!visited.has(node.id)) {
            if (dfs(node.id)) return true;
        }
    }
    return false
}

// Nodes left with indegree > 0 after the batch unwind are unreachable —
// that situation is exactly what a cycle produces.
export function executionBatch(nodes:WorkflowNode[],edges:WorkflowEdge[]):WorkflowNode[][]{
    if (nodes.length===0){
        return []
    }
    const graph=buildAdjacency(nodes,edges)
    const inDeg=calculateInDegree(nodes,edges)
    const batches:WorkflowNode[][]=[]
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    let currentbatch=nodes.filter((node)=>inDeg.get(node.id)==0)
    while (currentbatch.length>0){
        batches.push(currentbatch)
        let nextBatch:WorkflowNode[]=[]
        for (const node in currentbatch){
            for (const dependentId of graph.get(node)||[]){
                const inDegree=(inDeg.get(dependentId)||0)-1
                if (inDegree===0){
                    const dependentNode=nodeMap.get(dependentId)
                    if (dependentNode){
                        nextBatch.push(dependentNode)
                    }
                }
                inDeg.set(dependentId,inDegree)
            }
        }
        currentbatch=nextBatch
    }
    const processedCount = batches.reduce((sum, batch) => sum + batch.length, 0);
    if (processedCount !== nodes.length) {
        throw new Error("Circular dependency detected in workflow");
    }
    return batches
}

// Forward BFS from the trigger entry points (or every trigger when no start
// ids are given). Nodes not downstream of an entry — disconnected islands —
// are excluded from the run entirely.
export function getReachableNodes(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    startNodeIds?: string[],
): WorkflowNode[] {
    const graph = buildAdjacency(nodes, edges);

    const triggerTypes = [
        "triggerNode",
        "manualTrigger",
        "webhookTrigger",
        "cronTrigger",
    ];

    const triggerNodes =
        startNodeIds && startNodeIds.length > 0
            ? nodes.filter((n) => startNodeIds.includes(n.id))
            : nodes.filter((n) => triggerTypes.includes(n.type));

    if (triggerNodes.length === 0) return nodes;
    const visited = new Set<string>();
    const queue: string[] = [];

    for (const trigger of triggerNodes) {
        const hasOutgoing = edges.some((e) => e.source === trigger.id);
        if (hasOutgoing) {
            visited.add(trigger.id);
            queue.push(trigger.id);
        }
    }

    if (queue.length === 0) {
        if (startNodeIds && startNodeIds.length > 0) {
            return triggerNodes;
        }
        return nodes;
    }
    
    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const neighbor of graph.get(current) || []) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }
    return nodes.filter((n) => visited.has(n.id));
}

// Runs a node once every one of its incoming edges has a completed source
// (simple AND join; condition routing handled by the executor instead).
export function getReadyNodes(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    completedNodeIds: Set<string>,
    runningNodeIds: Set<string>,
    failedNodeIds: Set<string>,
): WorkflowNode[] {
    const readyNodes: WorkflowNode[] = [];
    for (const node of nodes) {
        if (
            completedNodeIds.has(node.id) ||
            runningNodeIds.has(node.id) ||
            failedNodeIds.has(node.id)
        ) {
            continue;
        }
        const incomingEdges = edges.filter((e) => e.target === node.id);
        const allDependenciesMet = incomingEdges.every((edge) =>
            completedNodeIds.has(edge.source),
        );
        if (allDependenciesMet) {
            readyNodes.push(node);
        }
    }
    return readyNodes;
}