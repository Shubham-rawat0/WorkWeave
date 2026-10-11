import { rateLimiter } from "hono-rate-limiter";
import { getClientIp } from "../utils/session";
import type { User } from "../schemas/types";

type RateLimitEnv = { Variables: { user: User } };

export const createRateLimiter = (limit: number, windowMs: number) => {
    return rateLimiter<RateLimitEnv>({
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
