import { createMiddleware } from "hono/factory";
import { getSessionUser } from "../utils/session";
import type { User } from "../schemas/types";
import { HTTPException } from "hono/http-exception";

export const authMiddleware = createMiddleware<{ Variables: { user: User } }>(
    async (c, next) => {
        const user = await getSessionUser(c);

        if (!user) {
                throw new HTTPException(401, {
                    message: "Not authenticated",
                });
            }
        c.set("user", user);
        await next();
    },
);
