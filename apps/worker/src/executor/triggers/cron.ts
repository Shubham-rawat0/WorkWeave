import { prisma } from "@WorkOrchestrator/prisma";
import type {
    CronTriggerNodeData,
    NodeExecutionOutput,
} from "../../engine/types/index.ts";

export async function executeCronTrigger(data:CronTriggerNodeData,nodeRunId:string):Promise<NodeExecutionOutput>{
    const nodeRun=await prisma.nodeRun.findUnique({
        where:{
            id:nodeRunId,
        },
        include:{
            workflowRun:{select:{
                metadata:true
            }}
        }
    });
    
    if (!nodeRun) {
        throw new Error(`Node run ${nodeRunId} not found`);
    }

    const metadata=(nodeRun?.workflowRun.metadata??{}) as Record<string,unknown>
    const source = typeof metadata.source === "string" ? metadata.source : "cron";
    const triggeredAt =
        typeof metadata.scheduledAt === "string"
            ? metadata.scheduledAt
            : new Date().toISOString();
    return {
        source,
        schedule: data.schedule ?? "daily",
        hour: data.hour ?? 9,
        minute: data.minute ?? 0,
        ...(typeof data.dayOfWeek === "number"
            ? { dayOfWeek: data.dayOfWeek }
            : {}),
        timezone: data.timezone ?? "UTC",
        triggeredAt,
    };
}