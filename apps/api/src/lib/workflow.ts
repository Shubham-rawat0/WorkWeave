function readStringId(value: unknown): string | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id.trim() : null;
}

function readEdgeEndpoint(value: unknown, key: "source" | "target"): string | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const endpoint = (value as { source?: unknown; target?: unknown })[key];
    return typeof endpoint === "string" ? endpoint.trim() : null;
}

function hasCycle(nodeIds: ReadonlySet<string>, edges: ReadonlyArray<{ source: string; target: string }>): boolean {
    const adjacency = new Map<string, string[]>();
    for (const id of nodeIds) {
        adjacency.set(id, []);
    }
    for (const edge of edges) {
        adjacency.get(edge.source)?.push(edge.target);
    }

    const VISITING = 1;
    const VISITED = 2;
    const state = new Map<string, number>();

    const visit = (node: string): boolean => {
        state.set(node, VISITING);
        for (const next of adjacency.get(node) ?? []) {
            const nextState = state.get(next);
            if (nextState === VISITING) {
                return true;
            }
            if (nextState !== VISITED && visit(next)) {
                return true;
            }
        }
        state.set(node, VISITED);
        return false;
    };

    for (const id of nodeIds) {
        if (state.get(id) !== VISITED && visit(id)) {
            return true;
        }
    }
    return false;
}

export function validateWorkflowGraph(
    nodes: readonly unknown[],
    edges: readonly unknown[],
): string[] {
    const errors: string[] = [];

    if (edges.length > 0 && nodes.length === 0) {
        errors.push("Graph cannot have edges when nodes are empty.");
    }

    const nodeIds = new Set<string>();
    for (const node of nodes) {
        const id = readStringId(node);
        if (!id) {
            errors.push("Each node must have a non-empty string id.");
            continue;
        }
        if (nodeIds.has(id)) {
            errors.push(`Duplicate node id "${id}".`);
            continue;
        }
        nodeIds.add(id);
    }

    const seenEdges = new Set<string>();
    const validEdges: Array<{ source: string; target: string }> = [];
    for (const edge of edges) {
        const source = readEdgeEndpoint(edge, "source");
        const target = readEdgeEndpoint(edge, "target");
        if (!source || !target) {
            errors.push("Each edge must include non-empty source and target ids.");
            continue;
        }
        const key = `${source}->${target}`;
        if (seenEdges.has(key)) {
            errors.push(`Duplicate edge "${source}" -> "${target}".`);
        } else {
            seenEdges.add(key);
        }
        if (!nodeIds.has(source)) {
            errors.push(`Edge source "${source}" does not exist in nodes.`);
        }
        if (!nodeIds.has(target)) {
            errors.push(`Edge target "${target}" does not exist in nodes.`);
        }
        if (nodeIds.has(source) && nodeIds.has(target)) {
            validEdges.push({ source, target });
        }
    }

    if (errors.length === 0 && hasCycle(nodeIds, validEdges)) {
        errors.push("Graph must not contain cycles.");
    }

    return errors;
}

export function getRunSource(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== "object") return null;
    const source = (
        metadata as {
            source?: unknown;
        }
    ).source;
    return typeof source === "string" ? source : null;
}