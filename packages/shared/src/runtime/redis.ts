import Redis, { type RedisOptions } from "ioredis";
import type { RedisOptions as BullRedisOptions } from "bullmq";

type RedisConnectionOptions = Pick<
    BullRedisOptions,
    | "host"
    | "port"
    | "username"
    | "password"
    | "db"
    | "maxRetriesPerRequest"
    | "lazyConnect"
    | "tls"
>;

const redisErrorLogTimestamps = new Map<string, number>();

const commonRedisOptions: RedisConnectionOptions = {
    maxRetriesPerRequest: null,
    lazyConnect: true,
};

let mainRedisClient: Redis | null = null;

function parseRedisPort(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}

function parseRedisUrl(url: string): RedisConnectionOptions {
    const parsed = new URL(url);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
        throw new Error(
            `[redis] Unsupported URL protocol "${parsed.protocol}". Use redis:// or rediss://`,
        );
    }
    const isTls = parsed.protocol === "rediss:";

    const options: RedisConnectionOptions = {
        ...commonRedisOptions,
        host: parsed.hostname,
        port: parseRedisPort(parsed.port || undefined, isTls ? 443 : 6379),
    };

    if (parsed.username) {
        options.username = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
        options.password = decodeURIComponent(parsed.password);
    }
    if (parsed.pathname && parsed.pathname !== "/") {
        const dbValue = Number.parseInt(parsed.pathname.slice(1), 10);
        if (Number.isFinite(dbValue) && dbValue >= 0) {
            options.db = dbValue;
        }
    }
    if (isTls) {
        options.tls = {};
    }

    return options;
}

export function getRedisConnectionOptions(): RedisConnectionOptions {
    const redisUrl = process.env.REDIS_URL?.trim() || process.env.UPSTASH_REDIS_URL?.trim();
    if (redisUrl) {
        const configuredFrom = process.env.REDIS_URL?.trim()
            ? "REDIS_URL"
            : "UPSTASH_REDIS_URL";
        try {
            return parseRedisUrl(redisUrl);
        } catch (error) {
            const details = error instanceof Error ? error.message : String(error);
            throw new Error(
                `[redis] Invalid ${configuredFrom}. Expected redis:// or rediss:// URL. ${details}`,
            );
        }
    }

    return {
        ...commonRedisOptions,
        host: process.env.REDIS_HOST || "localhost",
        port: parseRedisPort(process.env.REDIS_PORT, 6379),
    };
}

function logThrottledWarning(
    store: Map<string, number>,
    key: string,
    message: string,
): void {
    const now = Date.now();
    const last = store.get(key) ?? 0;
    if (now - last < 30_000) {
        return;
    }
    store.set(key, now);
    console.warn(message);
}

function attachRedisErrorLogging(client: Redis, label: string): void {
    client.on("error", (error) => {
        console.error(`[redis:${label}] error`, error);

        const reason = error instanceof Error ? error.message : String(error);
        logThrottledWarning(
            redisErrorLogTimestamps,
            `${label}:${reason}`,
            `[redis:${label}] unavailable: ${reason}`,
        );
    });
}

function createRedisClient(label:string):Redis{
    const client=new Redis(getRedisConnectionOptions() as RedisOptions & { replyMapping?: "legacy" })
    attachRedisErrorLogging(client,label)
    return client
}

export function getMainRedisClient():Redis{
    if (mainRedisClient){
        return mainRedisClient
    }
    mainRedisClient= createRedisClient("main")
    return mainRedisClient
}

export function CreateRedisSubscriber():Redis{
    return createRedisClient("subscriber")
}

export type {Redis}
