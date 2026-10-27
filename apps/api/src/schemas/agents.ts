import z from "zod";

export const workflowAgentInputSchema=z.object({
    workflowId:z.string().optional(),
    prompt:z.string().trim().min(1).max(500)
})

