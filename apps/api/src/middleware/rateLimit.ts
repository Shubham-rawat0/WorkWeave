import { rateLimiter } from "hono-rate-limiter";
import type { MiddlewareHandler } from "hono";
import type { Input, TypedResponse } from "hono/types";
import { getClientIp } from "../utils/session";
import type { User } from "../schemas/types";

type RateLimitEnv = { Variables: { user: User } };
type RateLimitResponse = TypedResponse<
    { error: string; message: string },
    429,
    "json"
>;
export const createRateLimiter = <P extends string = string>(
    limit: number,
    windowMs: number,
): MiddlewareHandler<RateLimitEnv, P, Input, RateLimitResponse> => {
    return rateLimiter<RateLimitEnv, P, Input, RateLimitResponse>({
        windowMs,
        limit,
        standardHeaders: "draft-6",
        keyGenerator: (c) => {
            const user = c.get("user");
            if (user?.id) {
                return `user:${user.id}`;
            }
            return getClientIp(c) ?? "unknown";
        },
        handler: (c) =>
            c.json(
                {
                    error: "Too many requests",
                    message: "Please try again later.",
                },
                429,
            ),
    });
};
