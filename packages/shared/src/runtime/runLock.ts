import { randomUUID } from "node:crypto";
import { getMainRedisClient } from "./redis";

export class RunReservationLockTimeoutError extends Error {
    constructor(userId: string) {
        super(`Timed out while reserving execution slot for user ${userId}`);
    }
}

const redis= getMainRedisClient()

function parsePositiveInt(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function getConfig() {
    return {
        ttlSec: parsePositiveInt(process.env.RUN_RESERVATION_LOCK_TTL_SECONDS, 10),
        waitMs: parsePositiveInt(process.env.RUN_RESERVATION_LOCK_WAIT_MS, 1500),
        retryMs: parsePositiveInt(process.env.RUN_RESERVATION_LOCK_RETRY_MS, 40),
    };
}

function sleep(ms:number):Promise<void>{
    return new Promise((resolve)=>setTimeout(resolve,ms))
}

function getUserLockKey(userId:string):string{
    return `redis-user-lock-key:user:${userId}`
}

async function releaseLock(key:string,token:string):Promise<void>{
     await redis.eval(
        `redis.call("get",KEYS[1])==ARGV[1] then
            return redis.call("del",KEYS[1])
        else
            return 0
        `,1,key,token
    )
}

export async function withUserRunReservationLock<T>(userId:string,fn:()=>Promise<T>):Promise<T>{
    const { ttlSec, waitMs, retryMs } = getConfig();
    const key=getUserLockKey(userId)
    const token=randomUUID()

    const deadline=Date.now()+waitMs

    let lockAcquired=false
    while(true){
        const acquired=await redis.set(key,token,"EX",ttlSec,"NX")
        if (acquired==="OK"){
            lockAcquired=true
            break
        }

        if (Date.now()>=deadline){
            throw new RunReservationLockTimeoutError(userId)
        }

        await sleep(retryMs)
    }

    try {
        return await fn()
    } finally {
        if (lockAcquired){
            await releaseLock(key, token).catch((error) => {
                console.error("Failed to release run reservation lock", error);
            });
        }
    }       
}