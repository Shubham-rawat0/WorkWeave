import { parseTemplateWithMetadata } from "@WorkOrchestrator/shared/parser";
import { FilterNodeData, NodeExecutionOutput } from "../../engine/types";

export async function executeFilterNode(
    data: FilterNodeData,
    runMetadata: Record<string, NodeExecutionOutput>,
): Promise<NodeExecutionOutput> {
    const template = typeof data.expression === "string" ? data.expression : "";
    const operator=data.operator??"equals"
    const comparedValue=data.value??""
    if (!template){
        return {
            filtered:true,
            reason :"Filter expression is empty"
        }
    }

    const parsed=parseTemplateWithMetadata(template,runMetadata as Record<string,string>)
    const resolved=parsed.output
    let passes=false

    switch (operator){
        case "equals":
            passes=resolved===comparedValue
            break
        case "contains":
            passes = resolved.includes(comparedValue)
            break
        case "not_equals":
            passes = resolved !== comparedValue
            break
        case "exists":
            passes = resolved.trim().length > 0;
            break;
        default:
            passes = false;
    }

    if (passes){
        return {
            filtered: false,
            passed: true,
            value: resolved,
        };
    }
    return {
        filtered: true,
        passed: false,
        reason: `Expression "${template}" resolved to "${resolved}" which did not pass ${operator} check`,
    };
}