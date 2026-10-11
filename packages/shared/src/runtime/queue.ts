import { Queue, QueueOptions } from "bullmq";
import { getRedisConnectionOptions } from "./redis";

const queueName = "workflow-runs";

let workflowQueueInstance: Queue | null = null;

const defaultJobOptions: NonNullable<QueueOptions["defaultJobOptions"]> = {
    attempts: 3,
    backoff: {
        type: "exponential",
        delay: 2000,
    },
    removeOnComplete: { count: 100, age: 24 * 3600 },
    removeOnFail: { count: 100, age: 24 * 3600 },
};

function createQueueOptions():QueueOptions{
    return {
        connection:getRedisConnectionOptions,
        defaultJobOptions
    }
}

export function getWorkflowQueue():Queue{
    if (workflowQueueInstance){
        return workflowQueueInstance
    }
    workflowQueueInstance=new Queue("workflow",createQueueOptions())
    return workflowQueueInstance
}

export interface WorkflowJobData {
    workflowRunId: string;
}