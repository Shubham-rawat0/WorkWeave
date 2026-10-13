import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { Prisma } from "@WorkOrchestrator/prisma";
import { auth, credentials, workflow } from "./routes";
import { authMiddleware } from "./middleware/auth";

const WEB_APP_URL = process.env.WEB_APP_URL ?? "http://localhost:3000";

export const app=new Hono()

app.use(
    "*",
    cors({
        origin: WEB_APP_URL,
        credentials: true,
    }),
);

app.use("*", async (c, next) => {
    const method = c.req.method;
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
        return next();
    }
    const origin = c.req.header("origin");
    if (origin && origin !== WEB_APP_URL) {
        throw new HTTPException(403, { message: "Invalid origin" });
    }
    await next();
});

app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return c.json(
            {
                message: err.message,
            },
            err.status,
        );
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
            return c.json({ message: "Resource already exists" }, 409);
        }
        if (err.code === "P2003") {
            return c.json({ message: "Referenced resource does not exist" }, 400);
        }
        if (err.code === "P2025") {
            return c.json({ message: "Resource not found" }, 404);
        }
    }

    if (err instanceof ZodError) {
        return c.json(
            {
                message: "Validation failed",
                errors: err.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                })),
            },
            400,
        );
    }

    console.error(err);
    return c.json(
        {
            message: "Internal server error",
        },
        500
    );
});

app.route("/api/v1/auth", auth);

app.use("/api/v1/workflow/*", authMiddleware);
app.route("/api/v1/workflow", workflow);

app.use("/api/v1/cred/*",authMiddleware)
app.route("/api/v1/cred",credentials)