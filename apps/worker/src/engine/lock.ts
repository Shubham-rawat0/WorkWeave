import { prisma } from "@WorkOrchestrator/prisma";
import { getMainRedisClient, withRedisFallback } from "@WorkOrchestrator/shared/redis";

export const LOCK_TTL_SECONDS = 5 * 60;

const redis=getMainRedisClient()

function lockKey(workflowRunId: string): string {
    return `lock:workflow-run:${workflowRunId}`;
}

function getLockStaleBeforeDate(ttlSeconds: number = LOCK_TTL_SECONDS): Date {
    return new Date(Date.now() - Math.max(1, Math.floor(ttlSeconds)) * 1000);
}

async function acquireDBLock(
    workflowRunId: string,
    workerId: string,
    ttlSeconds: number = LOCK_TTL_SECONDS,):Promise<boolean>{
        const date=new Date()
        const staleBefore=getLockStaleBeforeDate(ttlSeconds)
    const result=await prisma.workflowRun.updateMany({
        where:{
            id:workflowRunId,
            OR: [{ lockedAt: null },
                { lockedAt: { lt: staleBefore } },
                { lockedBy: workerId },]
        },
        data:{
            lockedAt:date,
            lockedBy:workerId
        }
    })
    return result.count>0
}

async function releaseDbLock(workflowRunId: string,workerId: string,):Promise<boolean>{
    const result=await prisma.workflowRun.updateMany({
        where:{
            id:workflowRunId,
            lockedBy:workerId
        },
        data:{
            lockedAt:null,
            lockedBy:null
        }
    })
    return result.count>0
}

async function renewDBLock(workflowRunId: string,workerId: string,):Promise<boolean>{
    const result = await prisma.workflowRun.updateMany({
        where: {
            id: workflowRunId,
            lockedBy: workerId,
        },
        data: {
            lockedAt: new Date(),
        },
    });
    return result.count > 0;
}

async function isDbLocked(
    workflowRunId: string,
    ttlSeconds: number = LOCK_TTL_SECONDS,
): Promise<boolean> {
    const run = await prisma.workflowRun.findUnique({
        where: { id: workflowRunId },
        select: { lockedAt: true },
    });
    if (!run?.lockedAt) {
        return false;
    }
    return run.lockedAt >= getLockStaleBeforeDate(ttlSeconds);
}

async function mutateLockIfOwned(
    workflowRunId: string,
    workerId: string,
    operation: "release" | "renew",
    ttlSeconds = LOCK_TTL_SECONDS,
): Promise<boolean> {
    const script = operation === "release"
        ? `if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end`
        : `if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("expire", KEYS[1], ARGV[2])
            else
                return 0
            end`;
    const result = await redis.eval(
        script,
        1,
        lockKey(workflowRunId),
        workerId,
        String(Math.max(1, Math.floor(ttlSeconds))),
    );
    return Number(result) === 1;
}

export async function releaseLock(workerId:string,workflowRunId:string):Promise<boolean>{
    return withRedisFallback("worker-lock:release",
        async()=>{
             return mutateLockIfOwned(workflowRunId, workerId, "release")
        },
        async ()=> releaseDbLock(workflowRunId,workerId)
    )
}

export async function acquireLock(workerId:string,workflowRunId:string):Promise<boolean>{
    return withRedisFallback(
        "worker-lock:acquire",
        async()=>{
            const key=lockKey(workflowRunId)
            const result=await redis.set(key,workerId,"EX",LOCK_TTL_SECONDS,"NX")
            return  result==="OK"
        },
        async()=>acquireDBLock(workflowRunId,workerId,LOCK_TTL_SECONDS)
    )
}

export async function renewLock(workerId: string, workflowRunId: string,ttlSeconds:number=LOCK_TTL_SECONDS): Promise<boolean> {
    const clampedTtl = Math.max(1, Math.floor(ttlSeconds));
    return withRedisFallback(
        "worker-lock:renew",
        async()=>{
            return mutateLockIfOwned(workflowRunId, workerId, "renew", clampedTtl)
        },
        async()=>{
            return renewDBLock(workflowRunId,workerId)
        }
    )
}

export async function isLocked(workflowRunId: string): Promise<boolean> {
    return withRedisFallback(
        "worker-lock:is-locked",
        async () => {
            const result = await redis.exists(lockKey(workflowRunId));
            return result === 1;
        },
        async () => isDbLocked(workflowRunId, LOCK_TTL_SECONDS),
    );
}
