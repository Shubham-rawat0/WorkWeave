import { config } from "dotenv";
import { resolve } from "node:path";
import http from "node:http";
import { WebSocketServer } from "ws";
import { Duplex } from "node:stream";
import { fileURLToPath } from "node:url";
import { ExecutionStreamTokenPayload, verifyExecutionStreamToken } from "@WorkOrchestrator/shared/executionSignature";
import { CreateRedisSubscriber } from "@WorkOrchestrator/shared/redis";

const currentDirectory = resolve(fileURLToPath(new URL(".", import.meta.url)));
config({ path: resolve(currentDirectory, "../../../.env"), override: false });

const host = process.env.REALTIME_HOST?.trim() || "::";
const port = Number.parseInt(
    process.env.REALTIME_PORT || process.env.PORT || "3101",
    10,
);

const signingSecret = process.env.EXECUTION_STREAM_SIGNING_SECRET?.trim()
if (!signingSecret || signingSecret.length === 0) {
    throw new Error(
        "Missing execution stream signing secret. Set BETTER_AUTH_SECRET or EXECUTION_STREAM_SIGNING_SECRET.",
    );
}
const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const PING_INTERVAL_MS = 25_000;

interface Websocket{
    readonly OPEN:number,
    readonly readyState:number;
    send(data:string):void;
    on(event:string,listener:(...args:unknown[])=>void):void
    close(code?:number,reason?:string):void
    terminate():void
    ping(data?:Buffer|string):void
}

const server=http.createServer((req,res)=>{
    const url = new URL(req.url || "/",
        `http://${req.headers.host || "localhost"}`,)
    if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
})

const wss=new WebSocketServer({noServer:true,maxPayload:1024*1024})

function sendJSON(ws:Websocket,payload:Record<string,unknown>):void{
    if (ws.readyState===ws.OPEN){
        ws.send(JSON.stringify(payload))
    }
}

function closeHTTPupgrade(socket:Duplex,statusCode:number,reason:string):void{
    const statusText =
        statusCode === 401
            ? "Unauthorized"
            : statusCode === 404
                ? "Not Found"
                : "Bad Request";
    socket.end(  //duplex stream to read and write provided by node
        `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
        "Connection: close\r\n" +
        "Content-Type: text/plain\r\n" +
        `Content-Length: ${Buffer.byteLength(reason)}\r\n` +
        "\r\n" +
        reason,
    );
}

//http connection upgrading to WS
server.on("upgrade",(req,socket,head)=>{
    try {
        const url = new URL(
            req.url || "/",
            `http://${req.headers.host || "localhost"}`,
        );
        if (url.pathname !== "/ws/executions") {
            console.warn(
                "[realtime] Rejected websocket upgrade: unknown route",
                url.pathname,
            );
            closeHTTPupgrade(socket, 404, "Unknown websocket route.");
            return;
        }


        const token=url.searchParams.get("token")
        if (!token) {
            console.warn("[realtime] Rejected websocket upgrade: missing token.");
            closeHTTPupgrade(socket, 401, "Missing token.");
            return;
        }

        let payload:ExecutionStreamTokenPayload
        try {
            payload=verifyExecutionStreamToken(token,signingSecret)
        } catch (error) {
            const reason = error instanceof Error ? error.message : "Invalid token.";
            console.warn(
                "[realtime] Rejected websocket upgrade: invalid token.",
                reason,
            );
            closeHTTPupgrade(socket, 401, reason);
            return;
        }

        //upgrading to http
        wss.handleUpgrade(req,socket,head,(ws:Websocket)=>{
            console.log(
                "[realtime] Accepted websocket connection for run",
                payload.runId,
            );
            wss.emit("connection", ws, payload);
        })
    } catch (error) {
        console.warn("[realtime] Rejected websocket upgrade: malformed request.");
        closeHTTPupgrade(socket, 400, "Malformed websocket upgrade request.");
    }
})

wss.on("connection",(ws:Websocket,payload:ExecutionStreamTokenPayload)=>{
    const channel = `workflow-run:${payload.runId}`
    let subscriber: ReturnType<typeof CreateRedisSubscriber>
    try {
        subscriber = CreateRedisSubscriber()
    } catch (error) {
        sendJSON(ws, {
            type: "socket",
            status: "subscription_error",
            error:
                error instanceof Error ? error.message : "Unknown redis error",
        })
        ws.close(1011, "Redis unavailable")
        return
    }
    let closed = false;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let tokenExpiryTimer: ReturnType<typeof setTimeout> | null = null;
    let isAlive = true;

    const clearTimers = () => {
        if (pingTimer) clearInterval(pingTimer);
        if (idleTimer) clearTimeout(idleTimer);
        if (tokenExpiryTimer) clearTimeout(tokenExpiryTimer);
        pingTimer = null;
        idleTimer = null;
        tokenExpiryTimer = null;
    };

    const cleanup = () => {
        if (closed) return;
        closed = true;
        clearTimers();
        subscriber.unsubscribe(channel).catch(() => undefined);
        subscriber.quit().catch(() => undefined);
    };

    const refreshIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            sendJSON(ws, { type: "socket", status: "idle_timeout" });
            ws.close(1000, "Idle timeout");
        }, IDLE_TIMEOUT_MS);
    };

    sendJSON(ws, { type: "connected", runId: payload.runId });
    refreshIdleTimer();

    subscriber.subscribe(channel).catch((error) => {
        sendJSON(ws, {
            type: "socket",
            status: "subscription_error",
            error:
                error instanceof Error ? error.message : "Unknown subscription error",
        });
        ws.close(1011, "Redis subscription failed");
    });

    subscriber.on("message", (incomingChannel,message)=>{
        if (incomingChannel !== channel || ws.readyState !== ws.OPEN) return;
        refreshIdleTimer();
        ws.send(message);
        try {
            const parsed = JSON.parse(message) as Record<string, unknown>;
            const type = typeof parsed.type === "string" ? parsed.type : "";
            const status = typeof parsed.status === "string" ? parsed.status : "";
            if (
                type === "workflow" &&
                (status === "Success" || status === "Failure")
            ) {
                setTimeout(() => {
                    if (ws.readyState === ws.OPEN) ws.close(1000, "Run finished");
                }, 500);
            }
        } catch { }
    });

    pingTimer = setInterval(() => {
        if (ws.readyState !== ws.OPEN) return;
        if (!isAlive) {
            ws.terminate();
            return;
        }
        isAlive = false;
        ws.ping();
    }, PING_INTERVAL_MS);

    const tokenExpiresInMs = Math.max(1_000, payload.exp * 1_000 - Date.now());
    tokenExpiryTimer = setTimeout(() => {
        sendJSON(ws, { type: "socket", status: "token_expired" });
        ws.close(4001, "Token expired");
    }, tokenExpiresInMs);

    ws.on("pong", () => {
        isAlive = true;
        refreshIdleTimer();
    });

    ws.on("message", () => {
        refreshIdleTimer();
    });

    ws.on("close", cleanup);
    ws.on("error", cleanup);
})

server.listen({ port, host, ipv6Only: false }, () => {
    console.log(`[realtime] Listening on ws://${host}:${port}/ws/executions`);
});
