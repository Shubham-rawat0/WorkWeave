import z from "zod";

export const workflowAgentInputSchema = z.object({
  workflowId: z.string().trim().min(1).max(100).optional(),
  prompt: z.string().trim().min(1).max(500),
  model: z.string().trim().min(1).max(100),
  credentialId: z.string().trim().min(1).max(100),
});
