import { hc, type ClientResponse, type InferResponseType } from "hono/client";
import type { AppType } from "@WorkOrchestrator/api";

export const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const GOOGLE_AUTH_URL = `${API_URL}/api/v1/auth/google`;

const client = hc<AppType>(`${API_URL}/api/v1`, {
    init: { credentials: "include" },
});

export type User = InferResponseType<typeof client.auth.me.$get>["user"];
export type WorkflowSummary =
    InferResponseType<typeof client.workflow.index.$get>[number];
export type SessionInfo =
    InferResponseType<typeof client.auth.sessions.$get>["sessions"][number];
export type WorkflowStatus = WorkflowSummary["lastRunStatus"];

async function unwrap<T>(request: Promise<ClientResponse<T>>): Promise<T> {
    const res = (await request) as unknown as Response & {
        json(): Promise<T>;
    };
    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
            message?: string;
        } | null;
        throw new Error(body?.message ?? `Request failed (${res.status})`);
    }
    return res.json();
}

export const api = {
    me: () => unwrap(client.auth.me.$get()),
    signin: (body: { email: string; password: string }) =>
        unwrap(client.auth.signin.$post({ json: body })),
    signup: (body: { name: string; email: string; password: string }) =>
        unwrap(client.auth.signup.$post({ json: body })),
    changePassword: (body: {
        currentPassword: string;
        newPassword: string;
        logoutOtherDevices?: boolean;
    }) => unwrap(client.auth["change-password"].$post({ json: body })),
    requestPasswordReset: (body: { email: string }) =>
        unwrap(client.auth["forgot-password"].request.$post({ json: body })),
    resetPassword: (body: {
        email: string;
        otp: string;
        newPassword: string;
    }) => unwrap(client.auth["forgot-password"].reset.$post({ json: body })),
    updateProfile: (body: { name: string; image?: string }) =>
        unwrap(client.auth.profile.$patch({ json: body })),
    sessions: () => unwrap(client.auth.sessions.$get()),
    revokeSession: (id: string) =>
        unwrap(client.auth.sessions[":id"].$delete({ param: { id } })),
    revokeOtherSessions: () => unwrap(client.auth.sessions.$delete()),
    signout: () => unwrap(client.auth.signout.$post()),
    workflows: () => unwrap(client.workflow.index.$get()),
};