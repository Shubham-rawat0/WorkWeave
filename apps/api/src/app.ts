import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import auth from "./routes/auth"

export const app=new Hono()

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