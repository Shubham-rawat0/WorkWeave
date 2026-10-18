import { parseTemplateWithMetadata } from "@WorkOrchestrator/shared/parser";
import type {
    TransformNodeData,
    NodeExecutionOutput,
} from "../../engine/types/index.js";
export async function executeTransformNode(
    data: TransformNodeData,
    runMetadata: Record<string, NodeExecutionOutput>,
): Promise<NodeExecutionOutput> {
    const template = typeof data.expression === "string" ? data.expression : "";
    if (!template) {
        return {
            success: false,
            error: "Transform expression is empty",
        };
    }
    const parsed = parseTemplateWithMetadata(
        template,
        runMetadata as Record<string, string>,
    );
    const output = parsed.output;
    if (
        parsed.missingVars &&
        parsed.missingVars.length > 0
    ) {
        const missingVarList = parsed.missingVars.join(", ");
        throw new Error(
            `Transform expression uses undefined variables: ${missingVarList}`,
        );
    }
    let result: NodeExecutionOutput;
    try {
        result = JSON.parse(output);
    } catch {
        result = output;
    }
    return {
        success: true,
        data: result,
        ...(parsed.missingVars ? { missingVars: parsed.missingVars } : {}),
    };
}