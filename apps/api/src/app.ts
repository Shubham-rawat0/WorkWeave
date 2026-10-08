import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import auth from "./routes/auth"

export const app=new Hono()

app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return err.getResponse();
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