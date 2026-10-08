import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { SigninSchema, SignupSchema } from "../schemas/auth";
import { prisma } from "@WorkOrchestrator/prisma";
import { comparePassword, hashPassword } from "../lib/hash";
import { HTTPException } from "hono/http-exception";

const app=new Hono()

app.post(
    "/signup",
    zValidator("json", SignupSchema),
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

        const user = await prisma.user.create({
            data: {
                name: body.name,
                email: body.email,
                password: hashPass,
                provider: "credentials",
            },
            select: {
                id: true,
                name: true,
                email: true,
                provider: true,
            },
        });

        return c.json(
            {
                message: "Created user successfully",
                user,
            },
            201
        );
    }
);

app.post(
    "/signin",
    zValidator("json", SigninSchema),
    async (c) => {
        const body = c.req.valid("json");

        const existingUser = await prisma.user.findUnique({
            where: {
                email: body.email,
            },
        });

        if (!existingUser) {
            throw new HTTPException(400, {
                message: "User don' exist",
            });
        }

        if (existingUser.provider!=="credentials"){
            throw new HTTPException(400, {
                message: "Continue with google",
            });
        }

        const valid = await comparePassword(body.password,existingUser.password!);
        if (!valid){
                throw new HTTPException(400, {
                    message: "Wrong credentials",
                });
        }
        const user = await prisma.user.findUnique({
            where:{
                email:body.email
            },
            select: {
                id: true,
                name: true,
                email: true,
                provider: true,
            },
        });

        return c.json(
            {
                message: "User fetched succesfully",
                user,
            },
            200
        );
    }
);

export default app