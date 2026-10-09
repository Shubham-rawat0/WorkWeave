import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { prisma, Prisma } from "@WorkOrchestrator/prisma";
import { SigninSchema, SignupSchema } from "../schemas/auth";
import { comparePassword, hashPassword } from "../lib/auth";
import { validationHook } from "../lib/validator";
import { createSession, invalidateSession, rotateSession } from "../utils/session";

const app = new Hono();

const userSelect = {
    id: true,
    name: true,
    email: true,
    provider: true,
} as const;

app.post(
    "/signup",
    zValidator("json", SignupSchema, validationHook),
    async (c) => {
        const body = c.req.valid("json");

        const existingUser = await prisma.user.findUnique({
            where: {
                email: body.email,
            },
        });

        if (existingUser) {
            throw new HTTPException(409, {
                message: "Email already registered",
            });
        }

        const hashPass = await hashPassword(body.password);

        let user;
        try {
            user = await prisma.user.create({
                data: {
                    name: body.name,
                    email: body.email,
                    password: hashPass,
                    provider: "credentials",
                },
                select: userSelect,
            });
        } catch (err) {
            if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === "P2002"
            ) {
                throw new HTTPException(409, {
                    message: "Email already registered",
                });
            }
            throw err;
        }

        await createSession(c, user.id);

        return c.json(
            {
                message: "Account created successfully",
                user,
            },
            201,
        );
    },
);

app.post(
    "/signin",
    zValidator("json", SigninSchema, validationHook),
    async (c) => {
        const body = c.req.valid("json");

        const user = await prisma.user.findUnique({
            where: {
                email: body.email,
            },
        });

        if (!user || user.provider !== "credentials" || !user.password) {
            throw new HTTPException(401, {
                message: "Invalid email or password",
            });
        }

        const validPassword = await comparePassword(
            body.password,
            user.password,
        );

        if (!validPassword) {
            throw new HTTPException(401, {
                message: "Invalid email or password",
            });
        }

        await rotateSession(c, user.id);

        return c.json(
            {
                message: "Signed in successfully",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    provider: user.provider,
                },
            },
            200,
        );
    },
);

app.post("/signout", async (c) => {
    await invalidateSession(c);

    return c.json(
        {
            message: "Signed out successfully",
        },
        200,
    );
});

export default app;
