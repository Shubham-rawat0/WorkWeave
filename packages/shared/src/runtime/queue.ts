import { Queue, type QueueOptions } from "bullmq";
import { getRedisConnectionOptions } from "./redis";

export const queueName = "workflow-runs";

let workflowQueueInstance: Queue | null = null;

// Retry budget: executeNode's permanent-failure check (retryCount >= 3)
// assumes exactly 3 attempts with exponential backoff starting at 2s.
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
        connection:getRedisConnectionOptions(),
        defaultJobOptions
    }
}

export function getWorkflowQueue():Queue{
    // Singleton: instances keep a socket per queue; recreating per call would
    // leak connections across every enqueue.
    if (workflowQueueInstance){
        return workflowQueueInstance
    }
    workflowQueueInstance=new Queue(queueName,createQueueOptions())
    return workflowQueueInstance
}

export interface WorkflowJobData {
    workflowRunId: string;
}