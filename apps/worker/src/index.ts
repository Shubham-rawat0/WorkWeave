import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadWorkerEnv(): void {
    dotenv.config({ quiet: true });
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const repoRootEnv = path.resolve(__dirname, "../../../.env");
    if (existsSync(repoRootEnv)) {
        dotenv.config({ path: repoRootEnv, override: false, quiet: true });
    }
}

function validateRequiredEnv(): void {
    if (!process.env.ENCRYPTION_KEY) {
        throw new Error(
            "ENCRYPTION_KEY is required for worker credential decryption. " +
            "Set the same ENCRYPTION_KEY used by the web app.",
        );
    }
}

const WORKER_ID = `worker-${process.pid}`;
const STARTUP_TIMEOUT_MS = 30_000;

let shuttingDown = false;
let stopCronScheduler: (() => void) | undefined;

async function bootstrap():Promise<void>{
    loadWorkerEnv()
    validateRequiredEnv()
    const [{ worker }, { startCronScheduler }] = await Promise.all([
        import("./worker"),
        import("./scheduler"),
    ]);

    process.on("unhandledRejection", (reason) => {
        console.error(`[${WORKER_ID}] Unhandled promise rejection:`, reason);
        process.exitCode = 1;
    });

    process.on("uncaughtException", (error) => {
        console.error(`[${WORKER_ID}] Uncaught exception:`, error);
        process.exit(1);
    });

    const shutdown = async (signal: NodeJS.Signals) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[${WORKER_ID}] Received ${signal}, shutting down worker...`);
        stopCronScheduler?.();
        const forceExit = setTimeout(() => {
            console.error(`[${WORKER_ID}] Shutdown timed out; forcing exit`);
            process.exit(1);
        }, 10_000);
        forceExit.unref();
        try {
            await worker.close();
            console.log(`[${WORKER_ID}] Worker gracefully stopped`);
            process.exit(0);
        } catch (error) {
            console.error(`[${WORKER_ID}] Error while closing worker:`, error);
            process.exit(1);
        } finally {
            clearTimeout(forceExit);
        }
    };

    process.on("SIGINT", () => { void shutdown("SIGINT"); });
    process.on("SIGTERM", () => { void shutdown("SIGTERM"); });

    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            worker.waitUntilReady(),
            new Promise<never>((_, reject) => {
                startupTimer = setTimeout(
                    () => reject(new Error(`Redis readiness timed out after ${STARTUP_TIMEOUT_MS}ms`)),
                    STARTUP_TIMEOUT_MS,
                );
            }),
        ]);
    } finally {
        if (startupTimer) clearTimeout(startupTimer);
    }
    if (shuttingDown) return;
    void worker.run().catch((error) => {
        console.error(
            `[${WORKER_ID}] Worker run loop stopped unexpectedly:`,
            error,
        );
        process.exit(1);
    });

    stopCronScheduler = startCronScheduler();
    console.log(
        `[${WORKER_ID}] Worker started and ready to process workflow runs`,
    );
}

void bootstrap().catch((error) => {
    console.error(`[${WORKER_ID}] Worker failed to start:`, error);
    process.exit(1);
});
