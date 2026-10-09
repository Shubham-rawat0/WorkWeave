import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { OAuth2Client } from "google-auth-library";

export const GOOGLE_SCOPES = ["openid", "email", "profile"];

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const OAUTH_STATE_COOKIE = IS_PRODUCTION
    ? "__Host-google_oauth"
    : "google_oauth";
const OAUTH_STATE_MAX_AGE = 10 * 60; // 10 minutes in seconds

const OAUTH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "Lax",
    path: "/",
} as const;

let client: OAuth2Client | undefined;

function getEnv(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "GOOGLE_REDIRECT_URI"): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing ${name} environment variable`);
    }

    return value;
}

export function getGoogleClientId(): string {
    return getEnv("GOOGLE_CLIENT_ID");
}

export function getGoogleOAuthClient(): OAuth2Client {
    if (client) {
        return client;
    }

    client = new OAuth2Client({
        clientId: getEnv("GOOGLE_CLIENT_ID"),
        clientSecret: getEnv("GOOGLE_CLIENT_SECRET"),
        redirectUri: getEnv("GOOGLE_REDIRECT_URI"),
    });

    return client;
}

export interface OAuthStateCookie {
    state: string;
    codeVerifier: string;
}

export function setOAuthStateCookie(
    c: Context,
    data: OAuthStateCookie,
): void {
    setCookie(c, OAUTH_STATE_COOKIE, JSON.stringify(data), {
        ...OAUTH_COOKIE_OPTIONS,
        maxAge: OAUTH_STATE_MAX_AGE,
    });
}

export function getOAuthStateCookie(c: Context): OAuthStateCookie | null {
    const raw = getCookie(c, OAUTH_STATE_COOKIE);

    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<OAuthStateCookie>;

        if (typeof parsed.state !== "string" || typeof parsed.codeVerifier !== "string") {
            return null;
        }

        return {
            state: parsed.state,
            codeVerifier: parsed.codeVerifier,
        };
    } catch {
        return null;
    }
}

export function clearOAuthStateCookie(c: Context): void {
    deleteCookie(c, OAUTH_STATE_COOKIE, OAUTH_COOKIE_OPTIONS);
}
