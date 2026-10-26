import { prisma } from "@WorkOrchestrator/prisma";
import { parseWorkflowNodes, WorkflowNode } from "./engine/types";
import { getMainRedisClient, withRedisFallback } from "@WorkOrchestrator/shared/redis";
import { RunReservationLockTimeoutError, withUserRunReservationLock } from "@WorkOrchestrator/shared/runLock";
import { getWorkflowQueue } from "@WorkOrchestrator/shared/queue";


const DB_HEALTHCHECK_TIMEOUT_MS = (() => {
    const parsed = Number.parseInt(
        process.env.CRON_DB_HEALTHCHECK_TIMEOUT_MS ?? "",
        10,
    );
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    return 5000;
})();

const redis=getMainRedisClient()

const DB_HEALTHCHECK_RETRIES = (() => {
    const parsed = Number.parseInt(
        process.env.CRON_DB_HEALTHCHECK_RETRIES ?? "",
        10,
    );
    if (Number.isFinite(parsed) && parsed >= 1) {
        return parsed;
    }
    return 2;
})();

const DB_HEALTHCHECK_RETRY_DELAY_MS = (() => {
    const parsed = Number.parseInt(
        process.env.CRON_DB_HEALTHCHECK_RETRY_DELAY_MS ?? "",
        10,
    );
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    return 500;
})();

// Per-process memory of the last bucket each schedule fired for — closes the
// gap between Redis dedupe failures and tolerates tick overlap.
const lastScheduledBucket = new Map<string, string>();

const CRON_DEDUPE_TTL_SECONDS = (() => {
    const parsed = Number.parseInt(process.env.CRON_DEDUPE_TTL_SECONDS ?? "", 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    return 8 * 24 * 60 * 60;
})();

type LimitErrorCode = "MONTHLY_LIMIT" | "CONCURRENT_LIMIT";

class RunLimitError extends Error {
    constructor(public readonly code: LimitErrorCode,message: string,) {
        super(message);
    }
}

function getMonthKey(now: Date): string {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getCronDedupeKey(
    workflowId: string,
    nodeId: string,
    bucket: string,
): string {
    return `fg:cron:bucket:${workflowId}:${nodeId}:${bucket}`;
}

async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delayMs = 2000,
): Promise<T> {
    for (let i=1;i<=retries;i+=1){
        try {
           return await fn()
        } catch (error) {
            if (i==retries){
                throw error
            }
            await new Promise((resolve)=>setTimeout(resolve,delayMs))
            delayMs*=2
        }
    }
    throw new Error("Unreachable")
}

function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
): Promise<T> {
    return new Promise((resolve,reject)=>{
        const timer = setTimeout(() => reject(new Error(label)), timeoutMs);
        promise.then((value)=>{
            clearTimeout(timer)
            resolve(value)
        })
        .catch((error)=>{
            clearTimeout(timer)
            reject(error)
        })
    })
}

function toCompactErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        const maybeCode =
            typeof (
                error as {
                    code?: unknown;
                }
            ).code === "string"
                ? (
                    error as {
                        code?: string;
                    }
                ).code
                : undefined;
        if (maybeCode) {
            return `${maybeCode}: ${error.message}`;
        }
        return error.message;
    }
    return String(error);
}

async function sleep(ms:number):Promise<void>{
    await new Promise((resolve)=>setTimeout(resolve,ms))
}

async function isDatabaseHealthy(): Promise<boolean> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= DB_HEALTHCHECK_RETRIES; attempt += 1) {
        try {
            await withTimeout(prisma.$queryRaw`Select 1`,
                DB_HEALTHCHECK_TIMEOUT_MS,
                "DB health check"
            )
            return true
        } catch (error) {
            lastError = error;
            if (attempt < DB_HEALTHCHECK_RETRIES) {
                await sleep(DB_HEALTHCHECK_RETRY_DELAY_MS * attempt);
            }
        }
    }
    if (process.env.NODE_ENV === "development") {
        console.warn(
            `[cron-scheduler] DB health check failed after ${DB_HEALTHCHECK_RETRIES} attempt(s), skipping tick. ${toCompactErrorMessage(lastError)}`,
        );
        return false;
    }
    console.warn(
        `[cron-scheduler] DB health check failed after ${DB_HEALTHCHECK_RETRIES} attempt(s), skipping tick. ${toCompactErrorMessage(lastError)}`,
    );
    return false;
}

function nowIndiaTime() {
    // Shift to India Standard Time (UTC+05:30), then read UTC fields.
    const now = new Date(Date.now() + 330 * 60 * 1000);
    return {
        now,
        minute: now.getUTCMinutes(),
        hour: now.getUTCHours(),
        dayOfWeek: now.getUTCDay(),
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        day: now.getUTCDate(),
    };
}

// Clamps user config to safe ranges; malformed or missing fields fall back
// to a daily 09:00 schedule instead of a never-firing cron.
function resolveSchedule(node: WorkflowNode): {
    schedule: "every_5_minutes" | "hourly" | "daily" | "weekly";
    hour: number;
    minute: number;
    dayOfWeek: number;
} {
    const data = node.data as Record<string, unknown>;
    const schedule =
        data.schedule === "every_5_minutes" ||
            data.schedule === "hourly" ||
            data.schedule === "weekly"
            ? data.schedule
            : "daily";
    const hour =
        typeof data.hour === "number"
            ? Math.max(0, Math.min(23, Math.floor(data.hour)))
            : 9;
    const minute =
        typeof data.minute === "number"
            ? Math.max(0, Math.min(59, Math.floor(data.minute)))
            : 0;
    const dayOfWeek =
        typeof data.dayOfWeek === "number"
            ? Math.max(0, Math.min(6, Math.floor(data.dayOfWeek)))
            : 1;
    return { schedule, hour, minute, dayOfWeek };
}

// Bucket keys carry the scheduled period (minute/hour/day) and become the
// Redis dedupe key so each period fires the schedule at most once.
function isDue(node: WorkflowNode): {
    due: boolean;
    bucket: string;
} {
    const { minute, hour, dayOfWeek, year, month, day } = nowIndiaTime();
    const cfg = resolveSchedule(node);

    if (cfg.schedule === "every_5_minutes") {
        const due = minute % 5 === 0;
        const bucket = `${year}-${month}-${day}-${hour}-${Math.floor(minute / 5)}`;
        return { due, bucket };
    }

    if (cfg.schedule === "hourly") {
        const due = minute === cfg.minute;
        const bucket = `${year}-${month}-${day}-${hour}`;
        return { due, bucket };
    }

    if (cfg.schedule === "weekly") {
        const due =
            dayOfWeek === cfg.dayOfWeek && hour === cfg.hour && minute === cfg.minute;
        const bucket = `${year}-${month}-${day}`;
        return { due, bucket };
    }

    const due = hour === cfg.hour && minute === cfg.minute;
    const bucket = `${year}-${month}-${day}`;
    return { due, bucket };
}

// Atomically creates the run and bumps the monthly usage counter inside one
// transaction, re-checking the concurrency gate at the last moment.
async function reserveCronRun(params: {
    workflowId: string;
    userId: string;
    nodeId: string;
    bucket: string;
    maxConcurrent: number;
}): Promise<{
    runId: string;
    month: string;
}> {
    const now= new Date()
    const month=getMonthKey(now)
    const maxConcurrent = params.maxConcurrent;

    const run=await prisma.$transaction(async(tx)=>{
        await tx.usageRecord.upsert({
            where:{
                userId_month:{userId:params.userId,month}
            },
            create:{
                userId:params.userId,
                month,
                runCount:0
            },
            update:{}
        })

        const pendingRuns=await tx.workflowRun.count({
            where:{
                status:"Pending",
                workflow: { userId: params.userId },
            }
        })

        if (pendingRuns>=maxConcurrent){
            throw new RunLimitError(
                "CONCURRENT_LIMIT",
                `Concurrent workflow limit reached (${maxConcurrent}).`,
            );
        }

        await tx.usageRecord.update({
            where: { userId_month: { userId: params.userId, month } },
            data: { runCount: { increment: 1 } },
        })

        return tx.workflowRun.create({
            data:{
                workflowId:params.workflowId,
                metadata: {
                    source: "cron",
                    nodeId: params.nodeId,
                    bucket: params.bucket,
                    scheduledAt: new Date().toISOString(),
                },
            }
        })
    })   
    return { runId: run.id, month }; 
}

async function rollbackRunReservation(
    runId: string,
    userId: string,
    month: string,
): Promise<void> {
    // Compensating action: the reservation transaction committed a run
    // and a runCount increment; if enqueue fails, undo both.
    await prisma.$transaction([
        prisma.workflowRun.update({
            where: { id: runId },
            data: {
                status: "Failure",
                finishedAt: new Date(),
                errorMetadata: {
                    message: "Failed to enqueue workflow run from scheduler",
                } as any,
            },
        }),
        prisma.usageRecord.update({
            where: { userId_month: { userId, month } },
            data: {
                runCount: { decrement: 1 },
            },
        }),
    ]);
}

// Ticks skip entirely if the DB is down — creating runs that can't be
// reserved/queued against a failing database is worse than waiting.
async function tick():Promise<void>{
    const dbHealthy=await isDatabaseHealthy()
    if (!dbHealthy) {
        return;
    }
    const workflows=await withRetry(()=> prisma.workflow.findMany({
        select:{
            id:true,
            userId: true,
            nodes: true,
            user: { select: { maxConcurrent: true } },
        }
    }))
    const activeScheduleKeys = new Set<string>();
    for (const workflow of workflows){
        let nodes: WorkflowNode[] = [];
        try {
            nodes=parseWorkflowNodes(workflow.nodes)
        } catch (error) {
            continue
        }
        const cronNodes = nodes.filter((node) => {
            if (node.type !== "cronTrigger") {
                return false;
            }
            const data = node.data as Record<string, unknown>;
            return data.isConfigured === true && data.isActive !== false;
        });
        if (cronNodes.length === 0) {
            continue;
        }

        for (const node of cronNodes){
            activeScheduleKeys.add(`${workflow.id}:${node.id}`);
            if (!workflow.userId) {
                continue;
            }
            const userId = workflow.userId;
            const { due, bucket } = isDue(node);
            if (!due) {
                continue;
            }
            const dedupeKey = `${workflow.id}:${node.id}`;
            // Dedupe per time bucket so cron fires at most once per bucket
            // even with multiple worker instances or worker restarts: layer 1
            // is in-memory, layer 2 is a Redis NX key with a long TTL (its
            // failure releases the lock so the next tick can retry).
            if (lastScheduledBucket.get(dedupeKey) === bucket) {
                continue;
            }
            const dedupeRedisKey = getCronDedupeKey(workflow.id, node.id, bucket);
            let dedupeAcquired = false;

            try {
                const result = await withRedisFallback(`cron-dedupe:${workflow.id}:${node.id}`,
                    async ()=>redis.set(dedupeRedisKey,"1","EX",CRON_DEDUPE_TTL_SECONDS,"NX"),
                    async ()=>"BYPASS_REDIS"
                )
                dedupeAcquired=result==="BYPASS_REDIS"||result==="OK"
            } catch (error) {
                console.error(
                    `[cron-scheduler] Failed to acquire dedupe lock ${workflow.id}/${node.id}:`,
                    error,
                );
                continue
            }

            if (!dedupeAcquired) {
                lastScheduledBucket.set(dedupeKey, bucket);
                continue;
            }

            lastScheduledBucket.set(dedupeKey, bucket);

            try {
                const reservation=await withUserRunReservationLock(userId,
                    ()=>reserveCronRun({
                        workflowId:workflow.id,
                        userId,
                        nodeId:node.id,
                        bucket,
                        maxConcurrent: workflow.user?.maxConcurrent ?? 2,
                    })
                )
                try {
                    await getWorkflowQueue().add(
                        "process-workflow",
                        { workflowRunId: reservation.runId },
                        { jobId: reservation.runId },)
                } catch (error) {
                    await rollbackRunReservation(
                        reservation.runId,
                        userId,
                        reservation.month,
                    );
                    throw error;
                }
            } catch (error) {
                if (error instanceof RunReservationLockTimeoutError) {
                    continue;
                }
                if (error instanceof RunLimitError) {
                    continue;
                }
                await redis.del(dedupeRedisKey).catch(() => { });
                console.error(
                    `[cron-scheduler] Failed to enqueue ${workflow.id}/${node.id}:`,
                    error,
                );
            }
        }
    }
    for (const key of lastScheduledBucket.keys()) {
        if (!activeScheduleKeys.has(key)) lastScheduledBucket.delete(key);
    }
}

export function startCronScheduler(): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleNextTick = () => {
        if (stopped) return;
        // Align every tick to the minute boundary: the hour/minute checks
        // below only work if evaluates happen within the right minute.
        const now = Date.now();
        const delay = 60_000 - (now % 60_000);
        timer = setTimeout(() => {
            void runTick();
        }, delay);
    };
    const runTick = async () => {
        if (stopped) return;
        try {
            await tick();
        } catch (error) {
            console.error("[cron-scheduler] Tick failed:", error);
        }
        scheduleNextTick();
    };
    void runTick();
    return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
    };
}
