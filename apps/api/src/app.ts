import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { Prisma } from "@WorkOrchestrator/prisma";
import { auth, credentials, workflow } from "./routes";
import { authMiddleware } from "./middleware/auth";

const WEB_APP_URL = process.env.WEB_APP_URL ?? "http://localhost:3000";

const apiV1 = new Hono()
    .route("/auth", auth)
    .route("/workflow", workflow)
    .route("/credentials", credentials);

export const app = new Hono()
    .use(
        "*",
        cors({
        origin: WEB_APP_URL,
        credentials: true,
        }),
    )
    .use("*", async (c, next) => {
        const method = c.req.method;
        if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
            return next();
        }
        const origin = c.req.header("origin");
        if (origin && origin !== WEB_APP_URL) {
            throw new HTTPException(403, { message: "Invalid origin" });
        }
        await next();
    })
    .onError((err, c) => {
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
    })
    .use("/api/v1/workflow/*", authMiddleware)
    .use("/api/v1/cred/*", authMiddleware)
    .route("/api/v1", apiV1);

export type AppType = typeof app;
