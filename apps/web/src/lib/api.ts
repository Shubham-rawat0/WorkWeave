import { hc, type ClientResponse } from "hono/client";
import type { AppType } from "@WorkOrchestrator/api";

export const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const GOOGLE_AUTH_URL = `${API_URL}/api/v1/auth/google`;

type RpcResponse = Promise<ClientResponse<unknown>>;
type JsonRequest = (args: { json: Record<string, unknown> }) => RpcResponse;
type DeleteSessionRequest = (args: { param: { id: string } }) => RpcResponse;

type ApiClient = {
    auth: {
        me: { $get: () => RpcResponse };
        signin: { $post: JsonRequest };
        signup: { $post: JsonRequest };
        "change-password": { $post: JsonRequest };
        "forgot-password": {
            request: { $post: JsonRequest };
            reset: { $post: JsonRequest };
        };
        profile: { $patch: JsonRequest };
        sessions: {
            $get: () => RpcResponse;
            $delete: () => RpcResponse;
            ":id": { $delete: DeleteSessionRequest };
        };
        signout: { $post: () => RpcResponse };
    };
    workflow: { index: { $get: () => RpcResponse } };
};

const client = hc<AppType>(`${API_URL}/api/v1`, {
    init: { credentials: "include" },
}) as unknown as ApiClient;

export type User = {
    id: string;
    name: string;
    email: string;
    image: string | null;
    provider: string;
};

export type WorkflowStatus = "Success" | "Failure" | "Pending";
export type WorkflowSummary = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    nodeCount: number;
    edgeCount: number;
    lastRunStatus: WorkflowStatus | null;
    lastRunAt: string | null;
};

export type SessionInfo = {
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    expiresAt: string;
    current: boolean;
};

async function unwrap<T>(request: RpcResponse): Promise<T> {
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
    me: () => unwrap<{ user: User }>(client.auth.me.$get()),
    signin: (body: { email: string; password: string }) =>
        unwrap<{ message: string; user: User }>(client.auth.signin.$post({ json: body })),
    signup: (body: { name: string; email: string; password: string }) =>
        unwrap<{ message: string; user: User }>(client.auth.signup.$post({ json: body })),
    changePassword: (body: {
        currentPassword: string;
        newPassword: string;
        logoutOtherDevices?: boolean;
    }) => unwrap<{ message: string; revokedSessions: number }>(client.auth["change-password"].$post({ json: body })),
    requestPasswordReset: (body: { email: string }) =>
        unwrap<{ message: string }>(client.auth["forgot-password"].request.$post({ json: body })),
    resetPassword: (body: {
        email: string;
        otp: string;
        newPassword: string;
    }) => unwrap<{ message: string }>(client.auth["forgot-password"].reset.$post({ json: body })),
    updateProfile: (body: { name: string; image?: string }) =>
        unwrap<{ message: string; user: User }>(client.auth.profile.$patch({ json: body })),
    sessions: () => unwrap<{ sessions: SessionInfo[] }>(client.auth.sessions.$get()),
    revokeSession: (id: string) =>
        unwrap<{ message: string }>(client.auth.sessions[":id"].$delete({ param: { id } })),
    revokeOtherSessions: () =>
        unwrap<{ message: string; revokedSessions: number }>(client.auth.sessions.$delete()),
    signout: () => unwrap<{ message: string }>(client.auth.signout.$post()),
    workflows: () => unwrap<WorkflowSummary[]>(client.workflow.index.$get()),
};
