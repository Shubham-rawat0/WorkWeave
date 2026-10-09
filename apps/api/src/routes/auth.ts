import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { CodeChallengeMethod } from "google-auth-library";
import { prisma, Prisma } from "@WorkOrchestrator/prisma";
import { SigninSchema, SignupSchema } from "../schemas/auth";
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
import { createSession, getSessionUser, invalidateSession, rotateSession } from "../utils/session";

const app = new Hono();

const userSelect = {
    id: true,
    name: true,
    email: true,
    provider: true,
} as const;

app.post(
    "/signup",
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
);

app.post(
    "/signin",
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
                    provider: user.provider,
                },
            },
            200,
        );
    },
);

app.post("/signout", async (c) => {
    await invalidateSession(c);

    return c.json(
        {
            message: "Signed out successfully",
        },
        200,
    );
});

app.get("/me", async (c) => {
    const user = await getSessionUser(c);

    if (!user) {
        throw new HTTPException(401, {
            message: "Not authenticated",
        });
    }

    return c.json({ user }, 200);
});

app.get("/google", async (c) => {
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
});

app.get("/google/callback", async (c) => {
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
        return c.redirect(redirectUrl);
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
