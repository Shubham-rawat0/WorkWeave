import z from "zod";

const MAX_MESSAGES = 100;

// Messages are validated against the AI SDK UI message schema in the route,
// which also supports tool parts from previous assistant turns.
export const workflowAgentInputSchema = z
  .object({
    workflowId: z.string().trim().min(1).max(100).optional(),
    prompt: z.string().trim().min(1).max(500).optional(),
    messages: z.array(z.looseObject({})).min(1).max(MAX_MESSAGES).optional(),
    model: z.string().trim().min(1).max(100),
    credentialId: z.string().trim().min(1).max(100),
  })
  .refine((input) => input.prompt !== undefined || input.messages !== undefined, {
    message: "Provide either prompt or messages.",
    path: ["prompt"],
  });
