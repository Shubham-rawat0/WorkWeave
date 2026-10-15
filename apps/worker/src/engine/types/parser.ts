import type { WorkflowEdge, WorkflowNode } from "./nodes";
import { workflowEdgeArraySchema, workflowNodeArraySchema } from "./schema";

export function parseWorkflowNodes(json: unknown): WorkflowNode[] {
    if (!Array.isArray(json)) {
        throw new Error("Workflow nodes must be an array");
    }
    return workflowNodeArraySchema.parse(json) as WorkflowNode[];
}
export function parseWorkflowEdges(json: unknown): WorkflowEdge[] {
    if (!Array.isArray(json)) {
        throw new Error("Workflow edges must be an array");
    }
    return workflowEdgeArraySchema.parse(json) as WorkflowEdge[];
}