import { createHmac, timingSafeEqual } from "node:crypto";

export interface ExecutionStreamTokenPayload {
    v: 1;
    runId: string;
    userId: string;
    iat: number;
    exp: number;
}
interface SignExecutionStreamTokenInput {
    runId: string;
    userId: string;
    ttlSeconds?: number;
    now?: Date;
}
const DEFAULT_TTL_SECONDS = 5 * 60;

function toBase64Url(input:string):string{
    return Buffer.from(input,"utf-8").toString("base64url")
}

function fromBase64Url(input:string):string{
    return Buffer.from(input,"base64url").toString("utf-8")
}

function signSegment(payload:string,secret:string):string{
    return  createHmac("sha-256",secret).update(payload).digest("base64url")
}

// Structural validation only (types/versions) — cryptographic checks and
// expiry live at the call sites; assertions narrow the type for TS.
function assertValidPayload(
    payload: unknown,
): asserts payload is ExecutionStreamTokenPayload {
    if (!payload || typeof payload !== "object") {
        throw new Error("Execution stream token payload is not an object.");
    }
    const obj = payload as Record<string, unknown>;
    if (obj.v !== 1)
        throw new Error("Execution stream token version is invalid.");
    if (typeof obj.runId !== "string" || obj.runId.trim().length === 0) {
        throw new Error("Execution stream token runId is invalid.");
    }
    if (typeof obj.userId !== "string" || obj.userId.trim().length === 0) {
        throw new Error("Execution stream token userId is invalid.");
    }
    if (!Number.isInteger(obj.iat) || !Number.isInteger(obj.exp)) {
        throw new Error("Execution stream token iat/exp is invalid.");
    }
}

/**
 * Signed execution-stream tokens: base64url(payload).base64url(HMAC-SHA256).
 * No JWT library — deliberately minimal, ~5min TTL, keyed by run + user so a
 * leaked token can only watch one specific run's pub/sub feed.
 */
export function signExecutionStreamToken(input: SignExecutionStreamTokenInput, secret: string): string {
    return signExecutionStreamTokenImpl(input, secret);
}
export { signExecutionStreamToken as SignExecutionStreamToken };

function signExecutionStreamTokenImpl(input: SignExecutionStreamTokenInput, secret: string): string {
    if (!secret || secret.trim().length === 0) {
        throw new Error("No execution signature");
    }
    if (!input.runId?.trim()) {
        throw new Error("Execution stream token requires runId.");
    }
    if (!input.userId?.trim()) {
        throw new Error("Execution stream token requires userId.");
    }
    const NowMs=(input.now?? new Date()).getTime()
    const iat=Math.floor(NowMs/1000)
    let ttlSeconds: number;
    if (input.ttlSeconds !== undefined && input.ttlSeconds !== null) {
        if (!Number.isFinite(input.ttlSeconds) || input.ttlSeconds <= 0) {
            throw new Error("Execution stream token ttlSeconds is invalid.");
        }
        ttlSeconds = Math.floor(input.ttlSeconds);
    } else {
        ttlSeconds = DEFAULT_TTL_SECONDS;
    }
    const exp = iat + ttlSeconds;
    const payload: ExecutionStreamTokenPayload = {
        v: 1,
        runId: input.runId.trim(),
        userId: input.userId.trim(),
        iat,
        exp,
    };
    const payloadSegment = toBase64Url(JSON.stringify(payload));
    const signedPayload = signSegment(payloadSegment, secret);
    return `${payloadSegment}.${signedPayload}`;
}

export function verifyExecutionStreamToken(input: string, secret: string, now: Date = new Date()): ExecutionStreamTokenPayload {
    return verifyExecutionStreamTokenImpl(input, secret, now);
}
export { verifyExecutionStreamToken as verifyExecutionStream };

// Rebuilds the expected HMAC for the payload segment and compares in
// constant time — verification recomputes rather than trusting the input.
function verifyExecutionStreamTokenImpl(input: string, secret: string, now: Date): ExecutionStreamTokenPayload {
    if (!secret || secret.trim().length === 0) {
        throw new Error("No execution signature");
    }
    if (typeof input !== "string") {
        throw new Error("Execution stream token format is invalid.");
    }
    const parts = input.split(".");
    if (parts.length !== 2) {
        throw new Error("Execution stream token format is invalid.");
    }
    const [payload, signedSegment] = parts;

    if (!payload || !signedSegment || payload.includes("..") || signedSegment.includes("..")) {
        throw new Error("Execution stream token format is invalid.");
    }

    let expectedSignature: string;
    try {
        expectedSignature = signSegment(payload, secret);
    } catch {
        throw new Error("Execution stream token signature is invalid.");
    }
    let providedSigBuffer: Buffer;
    let expectedSigBuffer: Buffer;
    try {
        providedSigBuffer = Buffer.from(signedSegment, "base64url");
        expectedSigBuffer = Buffer.from(expectedSignature, "base64url");
    } catch {
        throw new Error("Execution stream token signature is invalid.");
    }
    // timingSafeEqual: constant-time comparison prevents signature
    // forgery through response-timing side channels.
    if (
        providedSigBuffer.length !== expectedSigBuffer.length ||
        !timingSafeEqual(providedSigBuffer, expectedSigBuffer)
    ) {
        throw new Error("Execution stream token signature is invalid.");
    }
    let parsedPayload: unknown;
    try {
        parsedPayload = JSON.parse(fromBase64Url(payload));
    } catch {
        throw new Error("Execution stream token payload cannot be parsed.");
    }
    assertValidPayload(parsedPayload);
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (parsedPayload.exp <= nowSeconds) {
        throw new Error("Execution stream token has expired.");
    }
    if (parsedPayload.iat > nowSeconds) {
        throw new Error("Execution stream token iat is invalid.");
    }
    if (parsedPayload.exp < parsedPayload.iat) {
        throw new Error("Execution stream token exp is invalid.");
    }
    return parsedPayload;
}