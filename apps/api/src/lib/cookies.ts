type SameSite = "Strict" | "Lax" | "None";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function envFlag(name: string, fallback: boolean): boolean {
    const raw = process.env[name]?.trim().toLowerCase();
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
    return fallback;
}

// Services are often deployed on separate HTTPS hosts (web on Vercel, API on
// Render/Railway). In that case session cookies must be Secure + SameSite=None
// or browsers will not send them on cross-site requests.
const DEPLOYED_OVER_HTTPS = [process.env.API_URL, process.env.WEB_APP_URL].some(
    (value) => value?.trim().toLowerCase().startsWith("https://"),
);

export const COOKIE_SECURE = envFlag(
    "COOKIE_SECURE",
    IS_PRODUCTION || DEPLOYED_OVER_HTTPS,
);

export const COOKIE_SAME_SITE: SameSite = (() => {
    const configured = process.env.COOKIE_SAME_SITE?.trim().toLowerCase();
    if (configured === "strict") return "Strict";
    if (configured === "lax") return "Lax";
    if (configured === "none") return "None";
    return COOKIE_SECURE ? "None" : "Lax";
})();

export const SESSION_COOKIE_NAME = COOKIE_SECURE ? "__Host-session" : "session";
export const OAUTH_STATE_COOKIE_NAME = COOKIE_SECURE
    ? "__Host-google_oauth"
    : "google_oauth";

export const BASE_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    path: "/",
} as const;
