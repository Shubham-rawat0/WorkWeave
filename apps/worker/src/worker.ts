import { queueName, WorkflowJobData } from "@WorkOrchestrator/shared/queue";
import { getRedisConnectionOptions } from "@WorkOrchestrator/shared/redis";
import { Worker } from "bullmq";


const WORKER_ID = `worker-${process.pid}`;
const worker=new Worker<WorkflowJobData>(queueName,async(job)=>{
    console.log("job received",job.data)
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