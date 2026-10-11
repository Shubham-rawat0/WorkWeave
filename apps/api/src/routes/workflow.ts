import { Hono } from "hono";
import type { User } from "../schemas/types";
import { createRateLimiter } from "../middleware/rateLimit";

const app = new Hono<{ Variables: { user: User } }>();

app.use(createRateLimiter(120, 60_000))
app.get("/", async (c) => {
    const user = c.get("user");
    return c.json(user);
});

export default app