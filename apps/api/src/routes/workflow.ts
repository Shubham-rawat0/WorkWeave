import { Hono } from "hono";
import type { User } from "../schemas/types";
import { createRateLimiter } from "../middleware/rateLimit";
import { prisma } from "@WorkOrchestrator/prisma";
import { HTTPException } from "hono/http-exception";

const app = new Hono<{ Variables: { user: User } }>();

app.use(createRateLimiter(120, 60_000))

app.get("/workflows", async (c) => {
    const user = c.get("user");
    const userId = user.id;

    const workflows = await prisma.$queryRaw<
        Array<{
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            nodeCount: number;
            edgeCount: number;
            lastRunStatus: string | null;
            lastRunAt: Date | null;
        }>
    >`
    SELECT
      w."id",
      w."title",
      w."createdAt",
      w."updatedAt",
      CASE
        WHEN jsonb_typeof(w."nodes"::jsonb) = 'array'
        THEN jsonb_array_length(w."nodes"::jsonb)
        ELSE 0
      END::int AS "nodeCount",
      CASE
        WHEN jsonb_typeof(w."edges"::jsonb) = 'array'
        THEN jsonb_array_length(w."edges"::jsonb)
        ELSE 0
      END::int AS "edgeCount",
      lr."status"::text AS "lastRunStatus",
      lr."createdAt"    AS "lastRunAt"
    FROM "Workflow" w
    LEFT JOIN LATERAL (
      SELECT wr."status", wr."createdAt"
      FROM "WorkflowRun" wr
      WHERE wr."workflowId" = w."id"
      ORDER BY wr."createdAt" DESC
      LIMIT 1
    ) lr ON true
    WHERE w."userId" = ${userId}
    ORDER BY w."updatedAt" DESC;
  `;

    return c.json(
        workflows.map((workflow) => ({
            id: workflow.id,
            title: workflow.title,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt,
            nodeCount: workflow.nodeCount ?? 0,
            edgeCount: workflow.edgeCount ?? 0,
            lastRunStatus: workflow.lastRunStatus as
                | "Pending"
                | "Success"
                | "Failure"
                | null,
            lastRunAt: workflow.lastRunAt,
        }))
    );
});

app.get("/workflows/:id",async (c)=>{
    const id=c.req.param("id")
    const userId=c.get("user").id
    const workflow=await prisma.workflow.findFirst({
        where:{
            id,
            userId
        },
        include:{
            trigger: {
                include: { type: true}
            },
            actions:{
                include:{type: true},
                orderBy:{sortingOrder:"asc"}
            }
        }
    })

    if (!workflow){
        throw new HTTPException(404,{message:"workflow not found"})
    }
    return c.json({ workflow });
})

export default app