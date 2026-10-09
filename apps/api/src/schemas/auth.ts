import z from "zod";

const email = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Invalid email address"));

const password = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters");

export const SignupSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Name is required")
        .max(100, "Name must be at most 100 characters"),
    email,
    password,
});

export const SigninSchema = z.object({
    email,
    password,
});
