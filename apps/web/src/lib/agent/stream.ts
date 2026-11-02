import { API_URL } from "@/lib/api";

export type AgentStreamChunk = {
  type: string;
  [key: string]: unknown;
};

export type AgentTextHistoryPart = {
  type: "text";
  text: string;
};

export type AgentHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  parts: AgentTextHistoryPart[];
};

export type AgentChatRequestBody = {
  model: string;
  credentialId: string;
  messages: AgentHistoryMessage[];
  workflowId?: string;
};

export class AgentChatError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = "AgentChatError";
    this.status = status;
    this.requestId = requestId;
  }
}

type StreamAgentChatOptions = {
  body: AgentChatRequestBody;
  signal?: AbortSignal;
  onChunk: (chunk: AgentStreamChunk) => void;
};

function getErrorMessage(payload: unknown, status: number): string {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }
  return `Agent request failed (${status})`;
}

function parseEventData(rawEvent: string): string {
  return rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");
}

export async function streamAgentChat({
  body,
  signal,
  onChunk,
}: StreamAgentChatOptions): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/agent/chat`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  const requestId = response.headers.get("x-request-id") ?? undefined;

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const error = new AgentChatError(
      getErrorMessage(payload, response.status),
      response.status,
      requestId,
    );
    console.error("[agent] Chat request rejected", {
      status: error.status,
      requestId: error.requestId,
      message: error.message,
    });
    throw error;
  }

  if (!response.body) {
    throw new Error("The agent returned an empty response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consumeEvent = (rawEvent: string) => {
    const data = parseEventData(rawEvent);
    if (!data || data === "[DONE]") return;
    try {
      const chunk: unknown = JSON.parse(data);
      if (chunk && typeof chunk === "object" && "type" in chunk) {
        onChunk(chunk as AgentStreamChunk);
      } else {
        console.warn("[agent] Ignoring stream chunk without a type", {
          preview: data.slice(0, 500),
        });
      }
    } catch (error) {
      // Ignore malformed frames so one bad chunk does not end the stream.
      console.error("[agent] Failed to parse stream chunk", {
        preview: data.slice(0, 500),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        const match = buffer.slice(boundary).match(/^\r?\n\r?\n/);
        buffer = buffer.slice(boundary + (match?.[0].length ?? 2));
        consumeEvent(rawEvent);
        boundary = buffer.search(/\r?\n\r?\n/);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) consumeEvent(buffer);
  } finally {
    reader.releaseLock();
  }
}
