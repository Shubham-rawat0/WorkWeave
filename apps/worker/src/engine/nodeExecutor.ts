import { getMainRedisClient } from "@WorkOrchestrator/shared/redis";
import { NodeExecutionOutput, NodeRun, WorkflowNode } from "./types";
import { executeAINode, executeConditionNode, executeCronTrigger, executeDelayNode, executeFilterNode, executeGitHubNode, executeHTTPNode, executeLogNode, executeNotionNode, executeSlackNode, executeTransformNode, executeWebhookTriggerNode } from "../executor";
import { NodeStatus, prisma } from "@WorkOrchestrator/prisma";

const SSE_OUTPUT_MAX_BYTES = 8192;
const AI_NODE_TYPES = new Set([
    "aiNode",
    "openaiNode",
    "anthropicNode",
    "geminiNode",
]);
const SOFT_FAILURE_NODE_TYPES = new Set([
    "aiNode",
    "openaiNode",
    "anthropicNode",
    "geminiNode",
    "slackNode",
    "transformNode",
]);

const redis=getMainRedisClient()

function getAIProviderAlias(
    nodeType: string,
): "openai" | "anthropic" | "gemini" | null {
    if (nodeType === "aiNode" || nodeType === "openaiNode") return "openai";
    if (nodeType === "anthropicNode") return "anthropic";
    if (nodeType === "geminiNode") return "gemini";
    return null;
}

function getResponseName(node?: WorkflowNode): string | null {
    if (!node || !node.data ||typeof node.data!=="object"){
        return null
    }
    const responseName=(node.data as Record<string,unknown>).responseName
    if (typeof responseName!=="string"){
        return null
    }
    const trimmed=responseName.trim()
    return trimmed.length>0?trimmed:null
}

function getRunMetadataOutput(run: NodeRun): NodeExecutionOutput | undefined {
    if (run.status==="Success"){
        return run.output === null || run.output === undefined
            ? undefined
            : run.output;
    }
    if (run.status==="Skipped" &&run.output && typeof run.output==="object"){
        const skippedOutput = run.output as {
            bypassed?: unknown;
            passthrough?: unknown;
        };
        if (skippedOutput.bypassed === true) {
            const passthrough = skippedOutput.passthrough as
                | NodeExecutionOutput
                | undefined;
            if (passthrough !== undefined && passthrough !== null) {
                return passthrough;
            }
            return run.output;
        }
    }
    return undefined
}

function truncateForSSE(
    output: NodeExecutionOutput,
): NodeExecutionOutput | null {
    if (output === null || output === undefined) return null;
    try {
        const json = JSON.stringify(output);
        if (json.length <= SSE_OUTPUT_MAX_BYTES) return output;
        return {
            _truncated: true,
            _previewLength: json.length,
            _preview:
                typeof output === "string"
                    ? output.slice(0, 500) + "..."
                    : json.slice(0, 500) + "...",
        };
    } catch {
        return null;
    }
}

function getSoftFailureError(
    nodeType: string,
    output: NodeExecutionOutput,
): string | null {
    if (!SOFT_FAILURE_NODE_TYPES.has(nodeType)) {
        return null;
    }
    if (!output || typeof output !== "object" || Array.isArray(output)) {
        return null;
    }
    const success=(output as {
        success?:unknown
    }).success

    if (success!==false){
        return null
    }

    const error=(output as {
        error?:unknown
    }).error

    if (typeof error === "string" && error.trim().length > 0){
        return error
    }

    const reason=(output as {
        reason?:unknown
    }).reason

    if (typeof reason === "string" && reason.trim().length > 0) {
            return reason;
        }
    return `${nodeType} execution returned success=false`;
}

function publishNodeStatus(
    workflowRunId: string,
    nodeId: string,
    status: string,
    extra?: Record<string, unknown>,
) {
    redis.publish(`workflow-run:${workflowRunId}`,
        JSON.stringify({
            type: "node",
            nodeId,
            status,
            timestamp: Date.now(),
            ...extra,
        }),
    )
        .catch(() => { });
}

function findNodeRunForNode(
    existingNodeRuns: NodeRun[],
    nodeId: string,
): NodeRun | undefined {
    return existingNodeRuns.find((node)=>node.nodeId===nodeId)
}

async function executNodeLogic(
    node: WorkflowNode,
    nodeRunId: string,
    runMetadata: Record<string, NodeExecutionOutput>,
    ownerUserId: string,
): Promise<NodeExecutionOutput>{
    switch (node.type) {
        case "httpTrigger":
            return await executeHTTPNode(
                node.data,  
                runMetadata,
            );
        case "githubNode":
            return await executeGitHubNode(
                node.data,
                runMetadata,
                ownerUserId,
            );
        case "notionNode":
            return await executeNotionNode(
                node.data,
                runMetadata,
                ownerUserId,
            );
        case "slackNode":
            return await executeSlackNode(
                node.data,
                runMetadata,
                ownerUserId,
            );
        case "webhookTrigger":
            return await executeWebhookTriggerNode(nodeRunId);
        case "cronTrigger":
            return await executeCronTrigger(node.data, nodeRunId);
        case "conditionNode":
            return await executeConditionNode(node.data, runMetadata,);
        case "delayNode":
            return await executeDelayNode(node.data,);
        case "logNode":
            return await executeLogNode(node.data, runMetadata,);
        case "transformNode":
            return await executeTransformNode(node.data, runMetadata,);
        case "filterNode":
            return await executeFilterNode(node.data, runMetadata,);
        case "triggerNode":
        case "manualTrigger":
            return {
                triggeredAt: new Date().toISOString(),
                source: "manual",
            };
        case "aiNode":
        case "openaiNode":
        case "geminiNode":
        case "anthropicNode":
            return await executeAINode(
                node.type,
                node.data, 
                runMetadata,
                ownerUserId,
            );
        default:
            throw new Error(`Unsupported node type: ${node.type}`);
    }
}

export async function executeNode(
    workflowRunId: string,
    node: WorkflowNode,
    existingNodeRuns: NodeRun[],
    ownerUserId: string,
    nodeById?: Map<string, WorkflowNode>,
): Promise<void> {
    let nodeRun = findNodeRunForNode(existingNodeRuns, node.id);
    if (nodeRun) {
        if (nodeRun.status === NodeStatus.Success) {
            return;
        }
        if (nodeRun.status === NodeStatus.Failed && nodeRun.retryCount >= 3) {
            throw new Error(`Node ${node.id} failed permanently after 3 retries`);
        }

        nodeRun = await prisma.nodeRun.update({
            where: {
                id: nodeRun.id
            },
            data:{
                status: NodeStatus.Running,
                retryCount: nodeRun.retryCount + 1,
                startedAt: new Date(),
            }
        }) as NodeRun

        publishNodeStatus(workflowRunId, node.id, "Running", {
            nodeType: node.type})
    }
    else {
        nodeRun = (await prisma.nodeRun.create({
            data: {
                workflowRunId,
                nodeId: node.id,
                nodeType: node.type,
                status: NodeStatus.Running,
                retryCount: 0,
                startedAt: new Date(),
            },
        })) as NodeRun;
        publishNodeStatus(workflowRunId, node.id, "Running", {
            nodeType: node.type,
        });
    }

    try {
        const runMetadata: Record<string, NodeExecutionOutput> = {};
        const aiOutputs: NodeExecutionOutput[] = [];
        const providerOutputs: Partial<Record<"openai" | "anthropic" | "gemini", NodeExecutionOutput[]>> = {};

        for (const run of existingNodeRuns){
            const metadataValue=getRunMetadataOutput(run)
            if (metadataValue!==undefined){
                runMetadata[run.nodeId]=metadataValue
                const sourceNode=nodeById?.get(run.nodeId)
                const responseName=getResponseName(sourceNode)
                if (responseName && !(responseName in runMetadata)) {
                    runMetadata[responseName] = metadataValue;
                }

                if (sourceNode && AI_NODE_TYPES.has(sourceNode.type)) {
                    aiOutputs.push(metadataValue);
                    const providerAlias = getAIProviderAlias(sourceNode.type);
                    if (providerAlias) {
                        const existingProviderOutputs =
                            providerOutputs[providerAlias] ?? [];
                        existingProviderOutputs.push(metadataValue);
                        providerOutputs[providerAlias] = existingProviderOutputs;
                    }
                }
            }
        }
        if (aiOutputs.length === 1 && !("ai" in runMetadata)) {
            const aiOutput = aiOutputs[0];
            if (aiOutput !== undefined) {
                runMetadata.ai = aiOutput;
            }
        }

        for (const providerAlias of ["openai", "anthropic", "gemini"] as const) {
            const outputs = providerOutputs[providerAlias] ?? [];
            if (outputs.length === 1 && !(providerAlias in runMetadata)) {
                const providerOutput = outputs[0];
                if (providerOutput !== undefined) {
                    runMetadata[providerAlias] = providerOutput;
                }
            }
        }

        const output=await executNodeLogic(node,nodeRun.id,runMetadata,ownerUserId)

        const softFailureError = getSoftFailureError(node.type, output);
        if (softFailureError) {
            throw new Error(softFailureError);
        }

        if (output !== null) {
            await prisma.nodeRun.update({
                where: { id: nodeRun.id },
                data: {
                    status: NodeStatus.Success,
                    completedAt: new Date(),
                    output: output,
                },
            });
        } else {
            await prisma.nodeRun.update({
                where: { id: nodeRun.id },
                data: {
                    status: NodeStatus.Success,
                    completedAt: new Date(),
                },
            });
        }
        publishNodeStatus(workflowRunId, node.id, "Success", {
            nodeType: node.type,
            output: truncateForSSE(output),
        });
    } catch (error) {
        await prisma.nodeRun.update({
            where: { id: nodeRun.id },
            data: {
                status: NodeStatus.Failed,
                completedAt: new Date(),
                error: error instanceof Error ? error.message : "Unknown error",
            },
        });
        publishNodeStatus(workflowRunId, node.id, "Failed", {
            nodeType: node.type,
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
    }
}