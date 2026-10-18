import type {
    DelayNodeData,
    NodeExecutionOutput,
} from "../../engine/types/index.js";

const DEFAULT_DELAY_MAX_MS = 5 * 60 * 1000;

function sleep(duration:number):Promise<void>{
    return new Promise((resolve)=>setTimeout(resolve,duration))
}

function getDelayMaxMs(): number {
    const parsed = Number.parseInt(process.env.DELAY_NODE_MAX_MS ?? "", 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    return DEFAULT_DELAY_MAX_MS;
}

export async function executeDelayNode(
    data: DelayNodeData,
): Promise<NodeExecutionOutput> {
    const requested = typeof data.durationMs === "number" && Number.isFinite(data.durationMs)? Math.max(0, Math.floor(data.durationMs)): 0;

    const maxAllowed=getDelayMaxMs()
    const effective=Math.min(maxAllowed,requested)
    if (effective !== requested) {
        console.warn(
            `[delayNode] Delay capped from ${requested}ms to ${effective}ms (DELAY_NODE_MAX_MS=${maxAllowed})`,
        );
    }
    await sleep(effective);
    return {
        delayed: true,
        durationMs: effective,
        resumedAt: new Date().toISOString(),
    };
}