import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { CodeChallengeMethod } from "google-auth-library";
import { createHmac, randomInt } from "node:crypto";
import { prisma, Prisma } from "@WorkOrchestrator/prisma";
import { ChangePasswordSchema, ForgotPasswordRequestSchema, ForgotPasswordResetSchema, SigninSchema, SignupSchema, UpdateProfileSchema } from "../schemas/auth";
import { comparePassword, generateSessionToken, hashPassword } from "../lib/auth";
import {
    clearOAuthStateCookie,
    getGoogleClientId,
    getGoogleOAuthClient,
    getOAuthStateCookie,
    GOOGLE_SCOPES,
    setOAuthStateCookie,
} from "../lib/google";
import { validationHook } from "../lib/validator";
import {
    createSession,
    getSessionUser,
    invalidateSession,
    listSessions,
    revokeOtherSessions,
    revokeSession,
    rotateSession,
} from "../utils/session";
import { createRateLimiter } from "../middleware/rateLimit";
import { authMiddleware } from "../middleware/auth";
import { isSmtpConfigured, sendPasswordResetCode } from "../lib/email";

const app = new Hono()

const userSelect = {
    id: true,
    name: true,
    email: true,
    image: true,
    provider: true,
} as const;

const hashResetCode = (email: string, otp: string) => {
    const secret = process.env.BETTER_AUTH_SECRET ?? process.env.EXECUTION_STREAM_SIGNING_SECRET;
    if (!secret) throw new HTTPException(503, { message: "Password reset is not configured yet" });
    return createHmac("sha256", secret).update(`${email}:${otp}`).digest("hex");
};

app.post(
    "/change-password",
    authMiddleware,
    createRateLimiter(5, 60_000),
    zValidator("json", ChangePasswordSchema, validationHook),
    async (c) => {
        const { currentPassword, newPassword, logoutOtherDevices } = c.req.valid("json");
        const user = await prisma.user.findUnique({ where: { id: c.get("user").id } });
        if (!user || user.provider !== "credentials" || !user.password ||
            !(await comparePassword(currentPassword, user.password))) {
            throw new HTTPException(400, { message: "Current password is incorrect" });
        }
        if (await comparePassword(newPassword, user.password)) {
            throw new HTTPException(400, { message: "New password must be different from the current password" });
        }
        await prisma.user.update({
            where: { id: user.id },
            data: { password: await hashPassword(newPassword) },
        });

        let revokedSessions = 0;
        if (logoutOtherDevices) {
            revokedSessions = await revokeOtherSessions(c, user.id);
        }

        return c.json(
            {
                message: logoutOtherDevices
                    ? "Password updated. Other devices have been signed out."
                    : "Password updated successfully",
                revokedSessions,
            },
            200,
        );
    },
)

.post(
    "/forgot-password/request",
    createRateLimiter(3, 60_000),
    zValidator("json", ForgotPasswordRequestSchema, validationHook),
    async (c) => {
        if (!isSmtpConfigured() || !(process.env.BETTER_AUTH_SECRET ?? process.env.EXECUTION_STREAM_SIGNING_SECRET)) {
            throw new HTTPException(503, { message: "Password reset email is not configured yet" });
        }
        const { email } = c.req.valid("json");
        const user = await prisma.user.findUnique({ where: { email } });
        // Keep the response the same for unknown emails and accounts without password login.
        if (user?.provider === "credentials" && user.password) {
            const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
            const tokenHash = hashResetCode(email, otp);
            await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
            await prisma.passwordResetToken.create({
                data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 10 * 60_000) },
            });
            try {
                await sendPasswordResetCode(email, otp);
            } catch (err) {
                await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
                throw err;
            }
        }
        return c.json({ message: "If an account can be reset, a code has been sent" }, 200);
    },
)

.post(
    "/forgot-password/reset",
    createRateLimiter(5, 60_000),
    zValidator("json", ForgotPasswordResetSchema, validationHook),
    async (c) => {
        if (!(process.env.BETTER_AUTH_SECRET ?? process.env.EXECUTION_STREAM_SIGNING_SECRET)) {
            throw new HTTPException(503, { message: "Password reset is not configured yet" });
        }
        const { email, otp, newPassword } = c.req.valid("json");
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.provider !== "credentials" || !user.password) {
            throw new HTTPException(400, { message: "Invalid or expired reset code" });
        }
        const token = await prisma.passwordResetToken.findFirst({
            where: { userId: user.id, tokenHash: hashResetCode(email, otp), expiresAt: { gt: new Date() } },
        });
        if (!token) throw new HTTPException(400, { message: "Invalid or expired reset code" });

        const passwordHash = await hashPassword(newPassword);
        await prisma.$transaction(async (tx) => {
            const consumed = await tx.passwordResetToken.deleteMany({
                where: { id: token.id, expiresAt: { gt: new Date() } },
            });
            if (consumed.count !== 1) {
                throw new HTTPException(400, { message: "Invalid or expired reset code" });
            }
            await tx.user.update({ where: { id: user.id }, data: { password: passwordHash } });
            await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
            await tx.session.deleteMany({ where: { userId: user.id } });
        });
        return c.json({ message: "Password reset successfully. Please sign in." }, 200);
    },
)

.patch(
    "/profile",
    authMiddleware,
    createRateLimiter(20, 60_000),
    zValidator("json", UpdateProfileSchema, validationHook),
    async (c) => {
        const { name, image } = c.req.valid("json");
        const user = await prisma.user.update({
            where: { id: c.get("user").id },
            data: {
                name,
                ...(image === undefined ? {} : { image: image === "" ? null : image }),
            },
            select: userSelect,
        });
        return c.json({ message: "Profile updated successfully", user }, 200);
    },
)

.get(
    "/sessions",
    authMiddleware,
    createRateLimiter(60, 60_000),
    async (c) => {
        const sessions = await listSessions(c, c.get("user").id);
        return c.json({ sessions }, 200);
    },
)

.delete("/sessions", authMiddleware, async (c) => {
    const count = await revokeOtherSessions(c, c.get("user").id);
    return c.json(
        { message: "Signed out of all other devices", revokedSessions: count },
        200,
    );
})

.delete("/sessions/:id", authMiddleware, async (c) => {
    const revoked = await revokeSession(c.get("user").id, c.req.param("id"));
    if (!revoked) {
        throw new HTTPException(404, { message: "Session not found" });
    }
    return c.json({ message: "Session revoked successfully" }, 200);
})

.post(
    "/signup", createRateLimiter(5, 60_000),
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
)

.post(
    "/signin",
    createRateLimiter(5, 60_000),
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
                    image: user.image,
                    provider: user.provider,
                },
            },
            200,
        );
    },
)

.post("/signout", async (c) => {
    await invalidateSession(c);

    return c.json(
        {
            message: "Signed out successfully",
        },
        200,
    );
})

.get("/me", createRateLimiter(60, 60_000), async (c) => {
    const user = await getSessionUser(c);

    if (!user) {
        throw new HTTPException(401, {
            message: "Not authenticated",
        });
    }

    return c.json({ user }, 200);
})

.get("/google", createRateLimiter(10, 60_000), async (c) => {
    const client = getGoogleOAuthClient();

    const state = generateSessionToken();
    const { codeVerifier, codeChallenge } =
        await client.generateCodeVerifierAsync();

    setOAuthStateCookie(c, { state, codeVerifier });

    const authorizationUrl = client.generateAuthUrl({
        access_type: "offline",
        scope: [...GOOGLE_SCOPES],
        state,
        include_granted_scopes: true,
        prompt: "select_account",
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
    });

    return c.redirect(authorizationUrl);
})

.get("/google/callback", async (c) => {
    const storedState = getOAuthStateCookie(c);
    clearOAuthStateCookie(c);

    const error = c.req.query("error");
    if (error) {
        throw new HTTPException(400, {
            message: `Google authorization failed: ${error}`,
        });
    }

    const state = c.req.query("state");
    const code = c.req.query("code");

    if (!storedState || !state || state !== storedState.state) {
        throw new HTTPException(400, {
            message: "Invalid OAuth state",
        });
    }

    if (!code) {
        throw new HTTPException(400, {
            message: "Missing authorization code",
        });
    }

    const client = getGoogleOAuthClient();

    const { tokens } = await client.getToken({
        code,
        codeVerifier: storedState.codeVerifier,
    });

    if (!tokens.id_token) {
        throw new HTTPException(401, {
            message: "Missing ID token from Google",
        });
    }

    const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: getGoogleClientId(),
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
        throw new HTTPException(401, {
            message: "Google account has no email",
        });
    }

    if (!payload.email_verified) {
        throw new HTTPException(401, {
            message: "Google email is not verified",
        });
    }

    const email = payload.email.toLowerCase();

    let user = await prisma.user.findUnique({
        where: {
            email,
        },
        select: userSelect,
    });

    if (!user) {
        try {
            user = await prisma.user.create({
                data: {
                    name: payload.name ?? email.split("@")[0] ?? email,
                    email,
                    image: payload.picture ?? null,
                    provider: "google",
                },
                select: userSelect,
            });
        } catch (err) {
            if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === "P2002"
            ) {
                user = await prisma.user.findUnique({
                    where: {
                        email,
                    },
                    select: userSelect,
                });
            } else {
                throw err;
            }
        }
    }

    if (!user) {
        throw new HTTPException(500, {
            message: "Failed to create user account",
        });
    }

    if (user.provider !== "google") {
        throw new HTTPException(409, {
            message: `This email is already registered with ${user.provider}. Please sign in using ${user.provider}.`,
        });
    }

    await rotateSession(c, user.id);

    const redirectUrl = process.env.WEB_APP_URL;

    if (redirectUrl) {
        return c.redirect(`${redirectUrl}/home`);
    }

    return c.json(
        {
            message: "Signed in with Google",
            user,
        },
        200,
    );
});

export default app;
