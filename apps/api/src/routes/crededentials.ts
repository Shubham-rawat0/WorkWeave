import { Hono } from "hono";
import type { User } from "../schemas/types";
import { zValidator } from "@hono/zod-validator";
import { createCredentialsInputSchema, UpdateCredentialsInputSchema } from "../schemas/credentiaks";
import { validationHook } from "../lib/validator";
import { Prisma, prisma } from "@WorkOrchestrator/prisma";
import { HTTPException } from "hono/http-exception";
import { createRateLimiter } from "../middleware/rateLimit";
import { encryptJson } from "@WorkOrchestrator/shared/crypto";

function maskKeys(keys: Record<string,unknown>):Record<string,string>{
    const masked: Record<string, string> = {};
    for (const [key,val]  of Object.entries(keys)){
        const str=String(val)
        masked[key] =
            str.length > 4 ? "•".repeat(str.length - 4) + str.slice(-4) : "••••";
    }
    return masked
}

const app = new Hono<{Variables:{user:User}}>()
    .use("*", createRateLimiter(20,60_000))
    .post("/create",zValidator("json",createCredentialsInputSchema,validationHook),async(c)=>{
    const id=c.get("user").id
    const input=c.req.valid("json")
    const encrypted=encryptJson(input.keys)

    try {
        const credential=await prisma.credentials.create({
            data:{
                userId:id,
                keys:encrypted,
                platform:input.platform,
                title:input.title
            }
        })
        return c.json({
            id: credential.id,
            title: credential.title,
            platform: credential.platform,
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.message.includes('invalid input value for enum "Platform"')
        ) {
            throw new HTTPException(
                500,
                {message:
                    'Credential platform enum in database is out of sync.',
            });
        }
        throw error;
    }
})

.post("/update",zValidator("json",UpdateCredentialsInputSchema,validationHook),async(c)=>{
    const input=c.req.valid("json")
    const userId=c.get("user").id
    const exisiting=await prisma.credentials.findFirst({
        where:{id:input.id,userId}
    })
    if (!exisiting){
        throw new HTTPException(
            404,
            {
                message:
                    'Credential dont exist',
            });
    }

    const data:Record<string,unknown>={}

    if (input.title) data.title=input.title
    if (input.keys)  data.keys=encryptJson(input.keys)
    
     const credential = await prisma.credentials.update({
            where: { id: input.id },
            data,
        });
    return c.json({
        id: credential.id,
        title: credential.title,
        platform: credential.platform,
    })
})

.post("/remove/:id",async(c)=>{
    const userId=c.get("user").id
    const id=c.req.param("id")
    const existing = await prisma.credentials.findFirst({
        where: { id: id, userId: userId },
    });
    if (!existing) {
        throw new HTTPException(
            404,
            {message: "Credential not found",
        });
    }
    await prisma.credentials.delete({
        where:{id}
    })
    return c.json({ success: true })
})

.get("/",async(c)=>{
    const userId=c.get("user").id
    const credentials = await prisma.credentials.findMany({
        where: {
            userId: userId,
        },
        select: {
            id: true,
            title: true,
            platform: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    return c.json({credentials});
})

.get("/:id",async(c)=>{
    const userId = c.get("user").id
    const id=c.req.param("id")
    const credential = await prisma.credentials.findFirst({
        where: { id: id, userId: userId },
    });
    if (!credential) {
        throw new HTTPException(
            401,
            {message: "Credential not found",
        });
    }
    return c.json({
        id: credential.id,
        title: credential.title,
        platform: credential.platform,
        keys: maskKeys(credential.keys as Record<string, unknown>),
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
    });
});

export default app
