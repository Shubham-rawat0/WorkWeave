import { queueName, WorkflowJobData } from "@WorkOrchestrator/shared/queue";
import { getRedisConnectionOptions } from "@WorkOrchestrator/shared/redis";
import { Worker } from "bullmq";
import { executeWorkflow } from "./engine/executor";

const WORKER_ID = `worker-${process.pid}`;

export const worker=new Worker<WorkflowJobData>(queueName,async(job)=>{
    try{
        await executeWorkflow(job.data.workflowRunId)
    }
    catch(error){
        console.error(`[${WORKER_ID}] Job ${job.id} failed:`, error);
        throw error;
    }
}, {
    connection: getRedisConnectionOptions(),
    concurrency: 5,
    autorun: false,
},)

worker.on("failed", (job, err) => {
    console.error(`[${WORKER_ID}] Job ${job?.id} failed:`, err);
});
worker.on("error", (err) => {
    console.error(`[${WORKER_ID}] Worker error:`, err);
});