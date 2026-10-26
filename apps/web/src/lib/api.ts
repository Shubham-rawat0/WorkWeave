import {
    hc,
    type ClientResponse,
    type InferRequestType,
    type InferResponseType,
} from "hono/client";
import type { AppType } from "@WorkOrchestrator/api";

export const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const GOOGLE_AUTH_URL = `${API_URL}/api/v1/auth/google`;

const client = hc<AppType>(API_URL, {
    init: { credentials: "include" },
});

export type User = InferResponseType<typeof client.api.v1.auth.me.$get>["user"];

export type WorkflowSummary = InferResponseType<
    typeof client.api.v1.workflow.$get
>[number];

export type WorkflowStatus = Exclude<WorkflowSummary["lastRunStatus"], null>;
export type WorkflowDetails = InferResponseType<
    (typeof client.api.v1.workflow)[":id"]["$get"]
>["workflow"];
export type WebhookEndpoint = InferResponseType<
    (typeof client.api.v1.workflow)[":id"]["$get"]
>["webhookEndpoints"][number];

export type CredentialSummary = InferResponseType<
    typeof client.api.v1.credentials.$get
>["credentials"][number];

export type SessionInfo = InferResponseType<
    typeof client.api.v1.auth.sessions.$get
>["sessions"][number];

export type WorkflowRunSummary = {
    id: string;
    status: "Pending" | "Running" | "Success" | "Failure" | "Cancelled";
    createdAt: string;
    finishedAt: string | null;
    metadata?: unknown;
    errorMetadata?: unknown;
    workflow: { id: string; title: string };
    nodeRuns: Array<{
        id: string;
        nodeId: string;
        nodeType: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        error: string | null;
        input?: unknown;
        output: unknown;
    }>;
};

export type WorkflowRunsResponse = {
    workflowRuns: WorkflowRunSummary[];
    nextCursor?: string;
};

export type WorkflowUsage = InferResponseType<
    typeof client.api.v1.workflow.usage.$get
>;

type WorkflowRunsQuery = {
    workflowId: string;
    status?: "Pending" | "Running" | "Success" | "Failure" | "Cancelled";
    limit?: number;
    cursor?: string;
};

type ResponseBody<Response> = Response extends ClientResponse<
    infer Body,
    infer Status,
    "json"
>
    ? Status extends unknown
        ? Status extends 200 | 201
            ? Body
            : never
        : never
    : never;

function isSuccess<Response extends ClientResponse<unknown, number, "json">>(
    response: Response,
): response is Extract<Response, { status: 200 | 201 }> {
    return response.status === 200 || response.status === 201;
}

async function unwrap<
    Response extends ClientResponse<unknown, number, "json">,
>(request: Promise<Response>): Promise<ResponseBody<Response>> {
    const response = await request;
    if (!isSuccess(response)) {
        const body: unknown = await response
            .clone()
            .json()
            .catch(() => null);
        const message =
            body &&
            typeof body === "object" &&
            "message" in body &&
            typeof body.message === "string"
                ? body.message
                : `Request failed (${response.status})`;
        throw new Error(message);
    }
    // Hono's client models each response status as a union. After checking the
    // success status, associate its JSON body with the successful branch only.
    return (await response.json()) as ResponseBody<Response>;
}

export const api = {
    me: () => unwrap(client.api.v1.auth.me.$get()),
    signin: (
        body: InferRequestType<typeof client.api.v1.auth.signin.$post>["json"],
    ) => unwrap(client.api.v1.auth.signin.$post({ json: body })),
    signup: (
        body: InferRequestType<typeof client.api.v1.auth.signup.$post>["json"],
    ) => unwrap(client.api.v1.auth.signup.$post({ json: body })),
    changePassword: (
        body: InferRequestType<
            (typeof client.api.v1.auth)["change-password"]["$post"]
        >["json"],
    ) => unwrap(client.api.v1.auth["change-password"].$post({ json: body })),
    requestPasswordReset: (
        body: InferRequestType<
            (typeof client.api.v1.auth)["forgot-password"]["request"]["$post"]
        >["json"],
    ) =>
        unwrap(
            client.api.v1.auth["forgot-password"].request.$post({ json: body }),
        ),
    resetPassword: (
        body: InferRequestType<
            (typeof client.api.v1.auth)["forgot-password"]["reset"]["$post"]
        >["json"],
    ) =>
        unwrap(
            client.api.v1.auth["forgot-password"].reset.$post({ json: body }),
        ),
    updateProfile: (
        body: InferRequestType<typeof client.api.v1.auth.profile.$patch>["json"],
    ) => unwrap(client.api.v1.auth.profile.$patch({ json: body })),
    sessions: () => unwrap(client.api.v1.auth.sessions.$get()),
    revokeSession: (id: string) =>
        unwrap(
            client.api.v1.auth.sessions[":id"].$delete({ param: { id } }),
        ),
    revokeOtherSessions: () =>
        unwrap(client.api.v1.auth.sessions.$delete()),
    signout: () => unwrap(client.api.v1.auth.signout.$post()),
    workflows: () => unwrap(client.api.v1.workflow.$get()),
    workflow: (id: string) =>
        unwrap(
            client.api.v1.workflow[":id"].$get({
                param: { id },
            }),
        ),
    createWorkflow: (
        body: InferRequestType<
            typeof client.api.v1.workflow.create.$post
        >["json"],
    ) => unwrap(client.api.v1.workflow.create.$post({ json: body })),
    updateWorkflow: (
        body: InferRequestType<
            typeof client.api.v1.workflow.update.$post
        >["json"],
    ) => unwrap(client.api.v1.workflow.update.$post({ json: body })),
    executeWorkflow: (
        body: InferRequestType<
            typeof client.api.v1.workflow.execute.$post
        >["json"],
    ) => unwrap(client.api.v1.workflow.execute.$post({ json: body })),
    workflowRun: (id: string) =>
        unwrap(
            client.api.v1.workflow.workflow.run[":id"].$get({
                param: { id },
            }),
        ),
    cancelWorkflowRun: (id: string) =>
        unwrap(
            client.api.v1.workflow.workflow.run[":id"].cancel.$post({
                param: { id },
            }),
        ),
    workflowRuns: (query: WorkflowRunsQuery): Promise<WorkflowRunsResponse> => {
        const getWorkflowRuns = client.api.v1.workflow.runs.$get as (args: {
            query: WorkflowRunsQuery;
        }) => Promise<ClientResponse<WorkflowRunsResponse, 200, "json">>;
        return unwrap(getWorkflowRuns({ query }));
    },
    workflowUsage: () => unwrap(client.api.v1.workflow.usage.$get()),
    executionStream: (id: string) =>
        unwrap(
            client.api.v1.workflow.workflow.run[":id"].stream.$get({
                param: { id },
            }),
        ),
    credentials: () => unwrap(client.api.v1.credentials.$get()),
    createCredential: (
        body: InferRequestType<
            typeof client.api.v1.credentials.create.$post
        >["json"],
    ) => unwrap(client.api.v1.credentials.create.$post({ json: body })),
    updateCredential: (
        body: InferRequestType<
            typeof client.api.v1.credentials.update.$post
        >["json"],
    ) => unwrap(client.api.v1.credentials.update.$post({ json: body })),
    deleteCredential: (id: string) =>
        unwrap(
            client.api.v1.credentials.remove[":id"].$post({
                param: { id },
            }),
        ),
};
