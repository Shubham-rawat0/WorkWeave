import Redis, { type RedisOptions } from "ioredis";
import type { RedisOptions as BullRedisOptions } from "bullmq";

type RedisConnectionOptions = Pick<
    RedisOptions,
    | "host"
    | "port"
    | "username"
    | "password"
    | "db"
    | "maxRetriesPerRequest"
    | "lazyConnect"
    | "tls"
> & {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number | null;
    lazyConnect?: boolean;
    tls?: RedisOptions["tls"];
};

const redisErrorLogTimestamps = new Map<string, number>();

type RedisFallbackFactory<T> = () => T | Promise<T>;

const REDIS_CONNECT_ERROR_CODES = new Set([
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ETIMEDOUT",
    "ECONNRESET",
    "EHOSTUNREACH",
    "NR_CLOSED",
]);


// Keep normal clients bounded. BullMQ workers override this to null because
// queue commands are allowed to wait while Redis reconnects.
const commonRedisOptions: RedisConnectionOptions = {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
};
const fallbackLogTimestamps = new Map<string, number>();

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

// Only accept Upstash's native Redis TCP/TLS URL. REST credentials are HTTP
// credentials and cannot be used by ioredis or BullMQ.
function parseRedisUrl(url: string): RedisConnectionOptions {
    // dotenv preserves quotes when a value is quoted with spaces or other
    // special characters; accept the common quoted URL form as well.
    const normalizedUrl = url.trim().replace(/^(["'])(.*)\1$/, "$2");
    const parsed = new URL(normalizedUrl);
    if (parsed.protocol !== "rediss:") {
        throw new Error(
            `[redis] Unsupported URL protocol "${parsed.protocol}". Upstash connections require rediss://`,
        );
    }
    if (!parsed.hostname.toLowerCase().endsWith(".upstash.io")) {
        throw new Error("Redis host must be an Upstash *.upstash.io endpoint");
    }

    const options: RedisConnectionOptions = {
        ...commonRedisOptions,
        host: parsed.hostname,
        port: parseRedisPort(parsed.port || undefined, 6379),
    };

    if (parsed.username) {
        options.username = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
        options.password = decodeURIComponent(parsed.password);
    }
    if (!options.host || !options.password) {
        throw new Error("Redis URL must include a host and password");
    }
    if (parsed.pathname && parsed.pathname !== "/") {
        const dbValue = Number.parseInt(parsed.pathname.slice(1), 10);
        if (Number.isFinite(dbValue) && dbValue >= 0) {
            options.db = dbValue;
        }
    }
    options.tls = {};

    return options;
}

export function getRedisConnectionOptions(): RedisConnectionOptions {
    const redisUrl = process.env.REDIS_URL?.trim() || process.env.UPSTASH_REDIS_URL?.trim();
    if (!redisUrl) {
        throw new Error(
            "[redis] REDIS_URL is required and must be the Upstash TCP connection string from Connect → TCP (rediss://default:<password>@<host>.upstash.io:6379). REST URL/token cannot be used by BullMQ.",
        );
    }
    const configuredFrom = process.env.REDIS_URL?.trim()
        ? "REDIS_URL"
        : "UPSTASH_REDIS_URL";
    try {
        return parseRedisUrl(redisUrl);
    } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        throw new Error(`[redis] Invalid ${configuredFrom}. ${details}`);
    }
}

export function getBullMQRedisConnectionOptions(): BullRedisOptions {
    return {
        ...getRedisConnectionOptions(),
        maxRetriesPerRequest: null,
    };
}

function isConnectionMessage(message: string): boolean {
    const lowered = message.toLowerCase();
    return (
        lowered.includes("connection is closed") ||
        lowered.includes("connect econnrefused") ||
        lowered.includes("connect etimedout") ||
        lowered.includes("getaddrinfo enotfound") ||
        lowered.includes("socket closed")
    );
}

function getNestedErrors(error: unknown): unknown[] {
    if (!error || typeof error !== "object") {
        return [];
    }

    const maybeErrors = (error as { errors?: unknown }).errors;
    if (Array.isArray(maybeErrors)) {
        return maybeErrors;
    }

    return [];
}


function getErrorCode(error: unknown): string | null {
    if (!error || typeof error !== "object") {
        return null;
    }
    const maybeCode = (error as { code?: unknown }).code;
    if (typeof maybeCode !== "string") {
        return null;
    }
    return maybeCode;
}

// Recursively matches transport-level failures (including ioredis's
// MultiError envelope); non-connection errors must propagate untouched.
export function isRedisConnectionError(error: unknown): boolean {
    const code = getErrorCode(error);
    if (code && REDIS_CONNECT_ERROR_CODES.has(code)) {
        return true;
    }

    const nestedErrors = getNestedErrors(error);
    if (
        nestedErrors.length > 0 &&
        nestedErrors.some((nestedError) => isRedisConnectionError(nestedError))
    ) {
        return true;
    }

    if (error && typeof error === "object" && "cause" in error) {
        const cause = (error as { cause?: unknown }).cause;
        if (cause && isRedisConnectionError(cause)) {
            return true;
        }
    }

    if (error instanceof Error) {
        return isConnectionMessage(error.message);
    }
    return false;
}

// One warning per label per 30s: lazyConnect retries produce recurring
// errors that would otherwise spam logs.
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
        const code = getErrorCode(error);
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[redis:${label}] error${code ? ` (${code})` : ""}: ${reason}`);
        logThrottledWarning(
            redisErrorLogTimestamps,
            `${label}:${reason}`,
            `[redis:${label}] unavailable: ${reason}`,
        );
    });
}

// Runs `operation` on Redis and, on connection errors only (not app errors),
// degrades to `fallback` so locking/deduping keeps working when Redis is down.
export async function withRedisFallback<T>(
    context: string,
    operation: () => Promise<T>,
    fallback: RedisFallbackFactory<T>,
): Promise<T> {
    
    try {
        return await operation();
    } catch (error) {
        if (!isRedisConnectionError(error)) {
            throw error;
        }
        const reason = error instanceof Error ? error.message : String(error);
        logThrottledWarning(
            fallbackLogTimestamps,
            `${context}:${reason}`,
            `[redis-fallback:${context}] ${reason}`,
        );
        return await fallback();
    }
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
