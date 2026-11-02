import {app} from "./app"
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });
const port=process.env.PORT

const MIN_IDLE_TIMEOUT_SECONDS = 10;
const MAX_IDLE_TIMEOUT_SECONDS = 255;

function resolveIdleTimeout(): number {
    const parsed = Number.parseInt(
        process.env.API_IDLE_TIMEOUT_SECONDS ?? "",
        10,
    );
    if (!Number.isFinite(parsed)) return MAX_IDLE_TIMEOUT_SECONDS;
    if (parsed === 0) return 0;
    return Math.min(
        Math.max(parsed, MIN_IDLE_TIMEOUT_SECONDS),
        MAX_IDLE_TIMEOUT_SECONDS,
    );
}

export default {
    port: port,
    idleTimeout: resolveIdleTimeout(),
    fetch(request: Request, server: { timeout(request: Request, seconds: number): void }) {
        const { pathname } = new URL(request.url);
        if (pathname === "/api/v1/agent/chat" && request.method === "POST") {
            server.timeout(request, 0);
        }
        return app.fetch(request);
    },
};