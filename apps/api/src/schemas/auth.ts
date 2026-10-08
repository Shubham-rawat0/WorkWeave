import z from "zod";

export const SignupSchema=z.object({
    "email":z.string(),
    "password":z.string().min(8).max(20),
    "name":z.string()
})

export const SigninSchema=z.object({
    "email":z.string(),
    "password":z.string().min(8).max(20),
})