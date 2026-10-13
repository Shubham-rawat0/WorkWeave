import z from "zod";

export const createCredentialsInputSchema=z.object({
    title: z.string(),
    platform: z.enum([
        "telegram",
        "slack",
        "openai",
        "anthropic",
        "gemini",
        "github",
        "notion",
    ]),
    keys: z.record(z.string(), z.any()),
})

export const UpdateCredentialsInputSchema =z.object({
    id: z.string(),
    title: z.string().optional(),
    keys: z.record(z.string(), z.any()).optional(),
})