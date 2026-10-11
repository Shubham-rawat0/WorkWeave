import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { auth, workflow } from "./routes";
import { authMiddleware } from "./middleware/auth";

export const app=new Hono()

app.use(
    "*",
    cors({
        origin: process.env.WEB_APP_URL ?? "http://localhost:3000",
        credentials: true,
    }),
);

app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return c.json(
            {
                message: err.message,
            },
            err.status,
        );
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