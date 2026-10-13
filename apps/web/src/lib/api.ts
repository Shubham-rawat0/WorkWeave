export const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const GOOGLE_AUTH_URL = `${API_URL}/api/v1/auth/google`;

export interface User {
    id: string;
    name: string;
    email: string;
    image: string | null;
    provider: string;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
    body?: unknown;
}

async function request<T>(
    path: string,
    options: RequestOptions = {},
): Promise<T> {
    const { body, headers, ...rest } = options;

    const res = await fetch(`${API_URL}${path}`, {
        ...rest,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(headers as Record<string, string> | undefined),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = (await res.json().catch(() => null)) as
        | ({ message?: string } & T)
        | null;

    if (!res.ok) {
        throw new Error(data?.message ?? "Request failed");
    }

    return data as T;
}

export const api = {
    me: () => request<{ user: User }>("/api/v1/auth/me"),
    signin: (body: { email: string; password: string }) =>
        request<{ message: string; user: User }>("/api/v1/auth/signin", {
            method: "POST",
            body,
        }),
    signup: (body: { name: string; email: string; password: string }) =>
        request<{ message: string; user: User }>("/api/v1/auth/signup", {
            method: "POST",
            body,
        }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
        request<{ message: string }>("/api/v1/auth/change-password", { method: "POST", body }),
    requestPasswordReset: (body: { email: string }) =>
        request<{ message: string }>("/api/v1/auth/forgot-password/request", { method: "POST", body }),
    resetPassword: (body: { email: string; otp: string; newPassword: string }) =>
        request<{ message: string }>("/api/v1/auth/forgot-password/reset", { method: "POST", body }),
    updateProfile: (body: { name: string }) =>
        request<{ message: string; user: User }>("/api/v1/auth/profile", { method: "PATCH", body }),
    signout: () =>
        request<{ message: string }>("/api/v1/auth/signout", {
            method: "POST",
        }),
};
