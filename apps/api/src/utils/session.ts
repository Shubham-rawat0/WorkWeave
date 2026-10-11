import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { prisma } from "@WorkOrchestrator/prisma";
import { generateSessionToken, getHashToken } from "../lib/auth";

//network

export function getClientIp(c: Context): string | null {
    const forwardedFor = c.req.header("x-forwarded-for");
    const clientIp = forwardedFor?.split(",")[0]?.trim();

    if (clientIp) {
        return clientIp;
    }

    const realIp =
        c.req.header("x-real-ip")?.trim() ||
        c.req.header("cf-connecting-ip")?.trim();

    if (realIp) {
        return realIp;
    }
    return null
}

export function getUserAgent(c: Context): string | null {
    return c.req.header("user-agent") ?? null;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SESSION_COOKIE = IS_PRODUCTION
    ? "__Host-session"
    : "session";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "Lax",
    path: "/",
} as const;

export function getSessionCookie(c: Context): string | undefined {
    return getCookie(c, SESSION_COOKIE);
}

export function setSessionCookie(
    c: Context,
    token: string,
): void {
    setCookie(c, SESSION_COOKIE, token, {
        ...COOKIE_OPTIONS,
        maxAge: SESSION_MAX_AGE,
    });
}

export function clearSessionCookie(c: Context): void {
    deleteCookie(c, SESSION_COOKIE, COOKIE_OPTIONS);
}

async function deleteSessionByToken(token: string): Promise<void> {
    await prisma.session.deleteMany({
        where: {
            hashToken: getHashToken(token),
        },
    });
}

const sessionUserSelect = {
    id: true,
    name: true,
    email: true,
    image: true,
    provider: true,
} as const;

export async function getSessionUser(c: Context) {
    const token = getSessionCookie(c);

    if (!token) {
        return null;
    }

    const session = await prisma.session.findUnique({
        where: {
            hashToken: getHashToken(token),
        },
        select: {
            expiresAt: true,
            user: {
                select: sessionUserSelect,
            },
        },
    });

    if (!session) {
        return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
        await deleteSessionByToken(token);
        clearSessionCookie(c);
        return null;
    }

    return session.user;
}

export async function createSession(
    c: Context,
    userId: string,
): Promise<void> {
    const token = generateSessionToken();

    await prisma.session.create({
        data: {
            hashToken: getHashToken(token),
            expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
            ipAddress: getClientIp(c),
            userAgent: getUserAgent(c),
            userId,
        },
    });

    setSessionCookie(c, token);
}

export async function invalidateSession(c: Context): Promise<void> {
    const token = getSessionCookie(c);

    if (token) {
        await deleteSessionByToken(token);
    }

    clearSessionCookie(c);
}

export async function rotateSession(
    c: Context,
    userId: string,
): Promise<void> {
    const token = getSessionCookie(c);

    if (token) {
        await deleteSessionByToken(token);
    }

    await createSession(c, userId);
}
