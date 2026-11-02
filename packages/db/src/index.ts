import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(currentDirectory, "../../../.env"), override: false });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
}
const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
    keepAlive: true,
});

pool.on("error", (err) => {
    console.error("[prisma] Unexpected error on idle client", err);
});
const adapter = new PrismaPg(pool);

const TRANSIENT_CONNECTION_ERRORS = [
    "Connection terminated",
    "Connection closed",
    "Server has closed the connection",
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
];

const RETRYABLE_READ_OPERATIONS = new Set([
    "findUnique",
    "findUniqueOrThrow",
    "findFirst",
    "findFirstOrThrow",
    "findMany",
    "count",
    "aggregate",
    "groupBy",
]);

function isTransientConnectionError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }
    const message = (error as { message?: unknown }).message;
    return (
        typeof message === "string" &&
        TRANSIENT_CONNECTION_ERRORS.some((fragment) => message.includes(fragment))
    );
}

function createPrismaClient() {
    // Neon/pg may drop idle sockets; retry read-only queries on a fresh
    // connection instead of surfacing a one-off "Connection terminated".
    return new PrismaClient({ adapter }).$extends({
        query: {
            async $allOperations({ operation, args, query }) {
                if (!RETRYABLE_READ_OPERATIONS.has(operation)) {
                    return query(args);
                }
                const maxAttempts = 3;
                let lastError: unknown;
                for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                    try {
                        return await query(args);
                    } catch (error) {
                        lastError = error;
                        if (
                            attempt === maxAttempts ||
                            !isTransientConnectionError(error)
                        ) {
                            throw error;
                        }
                        await new Promise((resolve) =>
                            setTimeout(resolve, 100 * attempt),
                        );
                    }
                }
                throw lastError;
            },
        },
    });
}

const globalForPrisma = globalThis as unknown as {
    prisma: ReturnType<typeof createPrismaClient> | undefined;
};
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
export * from "../generated/prisma/client";
export {
    NodeStatus,
    WorkflowStatus,
    Platform,
} from "../generated/prisma/enums";
