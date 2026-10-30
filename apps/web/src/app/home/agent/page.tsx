"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Cpu,
  Eraser,
  KeyRound,
  Loader2,
  Send,
  SlidersHorizontal,
  Square,
  Wrench,
  X,
} from "lucide-react";
import { api, type CredentialSummary } from "@/lib/api";
import {
  AgentChatError,
  streamAgentChat,
  type AgentChatRequestBody,
  type AgentStreamChunk,
} from "@/lib/agent/stream";
import {
  classifyAgentError,
  parseAgentErrorText,
} from "@WorkOrchestrator/shared/ai/errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ProviderId = "google" | "openai" | "anthropic";

type ProviderMeta = {
  id: ProviderId;
  label: string;
  logo: string;
  platforms: string[];
  models: string[];
};

const PROVIDER_ORDER: ProviderId[] = ["google", "openai", "anthropic"];

const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  google: {
    id: "google",
    label: "Google",
    logo: "/logo/gemini.svg",
    platforms: ["google", "gemini"],
    models: [
      "models/gemini-3.1-pro-preview",
      "models/gemini-3-flash-preview",
      "models/gemini-3.6-flash",
      "models/gemini-3.5-flash",
      "models/gemini-3.1-flash-lite",
      "models/gemini-2.5-pro",
      "models/gemini-2.5-flash",
      "models/gemini-2.5-flash-lite",
    ],
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    logo: "/logo/openai.svg",
    platforms: ["openai"],
    models: [
      "gpt-5.2",
      "gpt-5.2-pro",
      "gpt-5.2-chat-latest",
      "gpt-5.1",
      "gpt-5.1-codex",
      "gpt-5",
      "gpt-5-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4o",
      "o3",
    ],
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    logo: "/logo/anthropic.svg",
    platforms: ["anthropic"],
    models: [
      "claude-opus-5-5",
      "claude-sonnet-5-5",
      "claude-haiku-5-5",
      "claude-opus-5",
      "claude-sonnet-5",
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ],
  },
};

type TextPart = { type: "text"; id: string; text: string };
type ToolPart = {
  type: "tool";
  id: string;
  name: string;
  input?: unknown;
  output?: unknown;
  state: "streaming" | "complete" | "error";
  errorText?: string;
};
type AgentErrorPart = {
  type: "error";
  id: string;
  errorText: string;
  state: "error";
};
type AgentPart = TextPart | ToolPart | AgentErrorPart;
type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  parts: AgentPart[];
};
type AgentEvent = {
  id: string;
  assistantId: string;
  receivedAt: number;
  chunk: AgentStreamChunk;
};
const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-[#333333] bg-[#151515] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#6b6b68] focus-visible:border-[#F04D26]/70 focus-visible:ring-1 focus-visible:ring-[#F04D26]/40 disabled:cursor-not-allowed disabled:opacity-50";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function messageToHistoryPart(message: AgentMessage): string {
  return message.parts
    .filter((part): part is TextPart => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function buildHistory(
  messages: AgentMessage[],
): AgentChatRequestBody["messages"] {
  return messages
    .map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: "text" as const, text: messageToHistoryPart(message) }],
    }))
    .filter((message) => message.parts[0]?.text);
}

function eventTone(type: string): string {
  if (type === "error" || type.includes("error")) return "text-red-300";
  if (type.startsWith("tool")) return "text-amber-200";
  if (type === "finish" || type === "finish-step") return "text-emerald-300";
  if (type.includes("text")) return "text-sky-300";
  if (type === "start" || type === "start-step") return "text-[#F04D26]";
  return "text-[#b0aea6]";
}

function describeEvent(chunk: AgentStreamChunk): string {
  const type = chunk.type;
  if (type === "text-delta") {
    return readString(chunk.delta) ?? "";
  }
  if (type === "reasoning-delta") {
    return readString(chunk.delta) ?? "";
  }
  if (type === "tool-input-start") {
    return `Calling ${readString(chunk.toolName) ?? "tool"}…`;
  }
  if (type === "tool-input-available") {
    return `${readString(chunk.toolName) ?? "tool"} input ${stringify(
      chunk.input,
    )}`;
  }
  if (type === "tool-input-delta") {
    return readString(chunk.inputTextDelta) ?? "";
  }
  if (type === "tool-output-available") {
    return `Output ${stringify(chunk.output)}`;
  }
  if (type === "tool-output-error") {
    return readString(chunk.errorText) ?? "Tool failed.";
  }
  if (type === "error") {
    const text = readString(chunk.errorText) ?? "Agent error.";
    const info = parseAgentErrorText(text);
    return info ? `${info.title}: ${info.message}` : text;
  }
  if (type === "finish") {
    const reason = readString(chunk.finishReason);
    return reason ? `Finished (${reason})` : "Finished";
  }
  if (type === "start") return "Run started";
  if (type === "start-step") return "Step started";
  if (type === "finish-step") return "Step finished";
  if (type === "abort") return readString(chunk.reason) ?? "Run aborted";
  return stringify(chunk);
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
}

function logAgentUiError(
  message: string,
  error: unknown,
  context: Record<string, unknown>,
) {
  console.error(`[agent] ${message}`, {
    ...context,
    error: serializeError(error),
  });
}

function ToolCall({ part, disabled }: { part: ToolPart; disabled: boolean }) {
  return (
    <details className="group">
      <summary
        onClick={(event) => disabled && event.preventDefault()}
        aria-disabled={disabled}
        className={cn(
          "flex list-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
      >
        <ChevronRight className="size-3.5 shrink-0 text-[#87867c] transition-transform group-open:rotate-90" />
        <Wrench className="size-3.5 shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1 truncate font-medium text-[#e8e6e1]">
          {part.name}
        </span>
        <span
          className={cn(
            "text-[10px] uppercase tracking-wider",
            part.state === "error"
              ? "text-red-300"
              : part.state === "streaming"
                ? "text-sky-300"
                : "text-[#7c7a72]",
          )}
        >
          {part.state === "streaming"
            ? "running"
            : part.state === "error"
              ? "failed"
              : "done"}
        </span>
      </summary>
      {part.input !== undefined && (
        <>
          <p className="mt-2 border-t border-white/[0.06] pt-2 font-mono text-[10px] uppercase tracking-wider text-[#6f6d66]">
            Input
          </p>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-[#b9b7af]">
            {stringify(part.input)}
          </pre>
        </>
      )}
      {part.output !== undefined && (
        <>
          <p className="mt-2 border-t border-white/[0.06] pt-2 font-mono text-[10px] uppercase tracking-wider text-[#6f6d66]">
            Output
          </p>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-emerald-200/80">
            {stringify(part.output)}
          </pre>
        </>
      )}
      {part.errorText && (
        <p className="mt-2 text-xs text-red-300">{part.errorText}</p>
      )}
    </details>
  );
}

function AgentErrorPartView({ part }: { part: AgentErrorPart }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-300">
          <AlertCircle className="size-3.5" />
          Agent error
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#7c7a72]">
          failed
        </span>
      </div>
      <p className="mt-2 break-words text-sm text-red-200">{part.errorText}</p>
    </div>
  );
}

function EventTrace({
  events,
  disabled,
}: {
  events: AgentEvent[];
  disabled: boolean;
}) {
  if (events.length === 0) return null;
  const hasError = events.some((event) => event.chunk.type.includes("error"));
  const toolCount = events.filter(
    (event) => event.chunk.type === "tool-input-start",
  ).length;

  return (
    <details className="group text-xs">
      <summary
        onClick={(event) => disabled && event.preventDefault()}
        aria-disabled={disabled}
        className={cn(
          "flex list-none items-center gap-2 rounded-lg px-3 py-2.5 text-[#b9b7af] transition-colors hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
      >
        <ChevronRight className="size-3.5 shrink-0 text-[#87867c] transition-transform group-open:rotate-90" />
        <span
          className={cn(
            "size-1.5 rounded-full",
            hasError ? "bg-red-400" : "bg-emerald-400",
          )}
        />
        <span className="font-medium">Agent activity</span>
        <span className="text-[#6f6d66]">
          {toolCount} tool {toolCount === 1 ? "call" : "calls"}
        </span>
        <span className="ml-auto font-mono text-[10px] text-[#6f6d66]">
          {events.length} events
        </span>
      </summary>
      <ol className="mt-1 max-h-64 space-y-0.5 overflow-y-auto py-1">
        {events.map((event) => (
          <li key={event.id}>
            <details className="group">
              <summary
                onClick={(clickEvent) =>
                  disabled && clickEvent.preventDefault()
                }
                aria-disabled={disabled}
                className={cn(
                  "flex list-none items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden",
                  disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                )}
              >
                <ChevronRight className="size-3 shrink-0 text-[#6f6d66] transition-transform group-open:rotate-90" />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate font-mono text-[10px] font-medium",
                    eventTone(event.chunk.type),
                  )}
                >
                  {event.chunk.type}
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#6f6d66]">
                  {formatTime(event.receivedAt)}
                </span>
              </summary>
              <p className="ml-8 whitespace-pre-wrap break-words border-l border-white/10 py-2 pl-3 font-mono text-[10px] leading-relaxed text-[#a4a29a]">
                {describeEvent(event.chunk)}
              </p>
            </details>
          </li>
        ))}
      </ol>
    </details>
  );
}

function MessageBubble({
  message,
  events = [],
  disabled = false,
}: {
  message: AgentMessage;
  events?: AgentEvent[];
  disabled?: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className="flex">
      <div
        className={cn(
          "min-w-0 space-y-2",
          isUser
            ? "ml-auto flex max-w-[85%] flex-col items-end"
            : "w-full",
        )}
      >
        {message.parts.length === 0 && !isUser && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#1d1d1d] px-3 py-2 text-sm text-[#87867c]">
            <Loader2 className="size-3.5 animate-spin" />
            Thinking…
          </div>
        )}
        {message.parts.map((part) =>
          part.type === "text" ? (
            part.text ? (
              <div
                key={`${part.type}-${part.id}`}
                className={cn(
                  "whitespace-pre-wrap break-words text-sm leading-relaxed",
                  isUser
                    ? "rounded-2xl bg-[#262626] px-4 py-3 text-white"
                    : "text-[#e8e6e1]",
                )}
              >
                {part.text}
              </div>
            ) : null
          ) : part.type === "error" ? (
            <AgentErrorPartView key={`${part.type}-${part.id}`} part={part} />
          ) : (
            <ToolCall
              key={`${part.type}-${part.id}`}
              part={part}
              disabled={disabled}
            />
          ),
        )}
        {!isUser && <EventTrace events={events} disabled={disabled} />}
      </div>
    </div>
  );
}

export default function AgentPage() {
  const [credentials, setCredentials] = useState<CredentialSummary[]>([]);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderId>("google");
  const [credentialId, setCredentialId] = useState("");
  const [model, setModel] = useState(PROVIDERS.google.models[0] ?? "");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAborting, setIsAborting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const agentRunIdRef = useRef<string | null>(null);
  const selectedProviderRef = useRef<ProviderId>("google");
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const providerMeta = PROVIDERS[provider];
  const providerCredentials = useMemo(
    () =>
      credentials.filter((credential) =>
        providerMeta.platforms.includes(credential.platform.toLowerCase()),
      ),
    [credentials, providerMeta],
  );
  const selectedCredential = providerCredentials.find(
    (credential) => credential.id === credentialId,
  );

  useEffect(() => {
    let isCurrent = true;
    api
      .credentials()
      .then((response) => {
        if (!isCurrent) return;
        const loaded = response.credentials;
        setCredentials(loaded);
        const available = PROVIDER_ORDER.find((id) =>
          loaded.some((credential) =>
            PROVIDERS[id].platforms.includes(credential.platform.toLowerCase()),
          ),
        );
        if (available) setProvider(available);
      })
      .catch((err: unknown) => {
        if (!isCurrent) return;
        logAgentUiError("Failed to load credentials", err, {
          scope: "credentials",
        });
        setCredentialsError(
          err instanceof Error ? err.message : "Failed to load credentials.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoadingCredentials(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const meta = PROVIDERS[provider];
    const matching = credentials.filter((credential) =>
      meta.platforms.includes(credential.platform.toLowerCase()),
    );

    if (selectedProviderRef.current !== provider) {
      selectedProviderRef.current = provider;
      setModel(meta.models[0] ?? "");
    }

    setCredentialId((current) =>
      matching.some((credential) => credential.id === current)
        ? current
        : (matching[0]?.id ?? ""),
    );
  }, [provider, credentials]);

  useEffect(() => {
    const element = messageListRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, events, isStreaming]);

  const updateAssistant = useCallback(
    (assistantId: string, updater: (parts: AgentPart[]) => AgentPart[]) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, parts: updater(message.parts) }
            : message,
        ),
      );
    },
    [],
  );

  const handleChunk = useCallback(
    (assistantId: string, chunk: AgentStreamChunk) => {
      if (
        !chunk.type.startsWith("text-") &&
        !chunk.type.startsWith("reasoning-")
      ) {
        setEvents((current) => [
          ...current.slice(-199),
          { id: nextId("event"), assistantId, receivedAt: Date.now(), chunk },
        ]);
      }

      switch (chunk.type) {
        case "start": {
          const metadata = isRecord(chunk.messageMetadata)
            ? chunk.messageMetadata
            : undefined;
          const agentRunId = metadata
            ? readString(metadata.agentRunId)
            : undefined;
          if (agentRunId) agentRunIdRef.current = agentRunId;
          return;
        }
        case "text-start":
        case "text-delta": {
          const partId = readString(chunk.id);
          if (!partId) return;
          const delta = readString(chunk.delta) ?? "";
          updateAssistant(assistantId, (parts) => {
            const index = parts.findIndex(
              (part) => part.type === "text" && part.id === partId,
            );
            if (index === -1) {
              return [...parts, { type: "text", id: partId, text: delta }];
            }
            return parts.map((part, partIndex) =>
              partIndex === index && part.type === "text"
                ? { ...part, text: part.text + delta }
                : part,
            );
          });
          return;
        }
        case "tool-input-start": {
          const toolCallId = readString(chunk.toolCallId) ?? nextId("tool");
          const name = readString(chunk.toolName) ?? "tool";
          updateAssistant(assistantId, (parts) =>
            parts.some((part) => part.type === "tool" && part.id === toolCallId)
              ? parts
              : [
                  ...parts,
                  { type: "tool", id: toolCallId, name, state: "streaming" },
                ],
          );
          return;
        }
        case "tool-input-available": {
          const toolCallId = readString(chunk.toolCallId);
          const name = readString(chunk.toolName) ?? "tool";
          updateAssistant(assistantId, (parts) => {
            const exists = parts.some(
              (part) => part.type === "tool" && part.id === toolCallId,
            );
            if (!exists) {
              return [
                ...parts,
                {
                  type: "tool",
                  id: toolCallId ?? nextId("tool"),
                  name,
                  input: chunk.input,
                  state: "complete",
                },
              ];
            }
            return parts.map((part) =>
              part.type === "tool" && part.id === toolCallId
                ? { ...part, name, input: chunk.input, state: "complete" }
                : part,
            );
          });
          return;
        }
        case "tool-output-available": {
          const toolCallId = readString(chunk.toolCallId);
          updateAssistant(assistantId, (parts) =>
            parts.map((part) =>
              part.type === "tool" && part.id === toolCallId
                ? { ...part, output: chunk.output, state: "complete" }
                : part,
            ),
          );
          return;
        }
        case "tool-output-error":
        case "tool-input-error": {
          const toolCallId = readString(chunk.toolCallId);
          updateAssistant(assistantId, (parts) =>
            parts.map((part) =>
              part.type === "tool" && part.id === toolCallId
                ? {
                    ...part,
                    state: "error",
                    errorText: readString(chunk.errorText) ?? "Tool failed.",
                  }
                : part,
            ),
          );
          return;
        }
        case "finish": {
          const metadata = isRecord(chunk.messageMetadata)
            ? chunk.messageMetadata
            : undefined;
          const agentRunId = metadata
            ? readString(metadata.agentRunId)
            : undefined;
          if (agentRunId) agentRunIdRef.current = agentRunId;
          return;
        }
        case "error": {
          if (abortRef.current?.signal.aborted) return;
          const errorText =
            readString(chunk.errorText) ?? "The agent run failed.";
          const info =
            parseAgentErrorText(errorText) ??
            classifyAgentError({ message: errorText });
          logAgentUiError("Agent stream emitted an error event", errorText, {
            agentRunId: agentRunIdRef.current,
            errorCode: info.code,
          });
          updateAssistant(assistantId, (parts) => [
            ...parts.filter((part) => part.type !== "error"),
            {
              type: "error",
              id: nextId("error"),
              errorText: info.message,
              state: "error",
            },
          ]);
          return;
        }
        default:
          return;
      }
    },
    [updateAssistant],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !credentialId || !model.trim() || isStreaming) return;

    const userMessage: AgentMessage = {
      id: nextId("user"),
      role: "user",
      parts: [{ type: "text", id: nextId("text"), text }],
    };
    const assistantMessage: AgentMessage = {
      id: nextId("assistant"),
      role: "assistant",
      parts: [],
    };
    const history = buildHistory([...messages, userMessage]);

    agentRunIdRef.current = null;
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setNotice(null);
    setIsAborting(false);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamAgentChat({
        body: {
          credentialId,
          model: model.trim(),
          messages: history,
        },
        signal: controller.signal,
        onChunk: (chunk) => handleChunk(assistantMessage.id, chunk),
      });
    } catch (err) {
      if (isAbortError(err)) {
        console.info("[agent] Request stopped", {
          agentRunId: agentRunIdRef.current,
          provider,
          model: model.trim(),
          credentialId,
        });
        setNotice("Request stopped. The agent will not continue generating.");
        return;
      }
      const info =
        err instanceof AgentChatError
          ? classifyAgentError({
              message: err.message,
              statusCode: err.status,
              provider,
            })
          : classifyAgentError({
              message:
                err instanceof Error
                  ? err.message
                  : "The agent request failed.",
              provider,
            });
      logAgentUiError("Agent request failed", err, {
        agentRunId: agentRunIdRef.current,
        provider,
        model: model.trim(),
        credentialId,
        messageCount: history.length,
        status: err instanceof AgentChatError ? err.status : undefined,
        requestId: err instanceof AgentChatError ? err.requestId : undefined,
        errorCode: info.code,
      });
      setEvents((current) => [
        ...current.slice(-499),
        {
          id: nextId("event"),
          assistantId: assistantMessage.id,
          receivedAt: Date.now(),
          chunk: {
            type: "error",
            errorText: info.message,
          },
        },
      ]);
      updateAssistant(assistantMessage.id, (parts) => [
        ...parts.filter((part) => part.type !== "error"),
        {
          type: "error",
          id: nextId("error"),
          errorText: info.message,
          state: "error",
        },
      ]);
    } finally {
      setIsStreaming(false);
      setIsAborting(false);
      abortRef.current = null;
    }
  }, [
    credentialId,
    handleChunk,
    input,
    isStreaming,
    messages,
    model,
    provider,
  ]);

  function handleStop() {
    if (!isStreaming || isAborting) return;
    setIsAborting(true);
    setNotice("Stopping request…");
    console.info("[agent] Stop requested", {
      agentRunId: agentRunIdRef.current,
      provider,
      model: model.trim(),
      credentialId,
    });
    abortRef.current?.abort();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  function clearConversation() {
    if (isStreaming) return;
    setMessages([]);
    setEvents([]);
    setNotice(null);
    agentRunIdRef.current = null;
  }

  const canSend =
    Boolean(input.trim()) &&
    Boolean(credentialId) &&
    Boolean(model.trim()) &&
    !isStreaming;
  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex h-[calc(100svh-7rem)] w-full max-w-4xl flex-col gap-4">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={clearConversation}
            disabled={isStreaming || messages.length === 0}
            className="border-[#333333] bg-[#1d1d1d] text-[#e8e6e1] hover:bg-[#242424] hover:text-white"
          >
            <Eraser className="size-4" />
            Clear chat
          </Button>
        </div>

        {notice && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 flex-1 break-words">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notice"
              className="shrink-0 rounded p-0.5 text-amber-200/70 transition-colors hover:bg-amber-500/20 hover:text-amber-100"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <section className="mx-auto flex min-h-0 w-full flex-1 flex-col">
          <div
            ref={messageListRef}
            className="min-h-0 flex-1 space-y-6 overflow-y-auto py-4"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div>
                  <p className="text-xl font-medium tracking-tight text-white">
                    What would you like to build?
                  </p>
                  <p className="mt-2 max-w-md text-sm text-[#87867c]">
                    Ask about a workflow, or describe an automation you want to
                    create.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  events={events.filter(
                    (event) => event.assistantId === message.id,
                  )}
                  disabled={isStreaming}
                />
              ))
            )}
          </div>

          <div className="shrink-0 pb-2 pt-3">
            <div className="overflow-hidden rounded-3xl border border-white/15 bg-[#202020] shadow-xl shadow-black/20 focus-within:border-white/25">
              <button
                type="button"
                onClick={() => setConfigOpen((open) => !open)}
                aria-expanded={configOpen}
                aria-controls="agent-configuration"
                disabled={isStreaming}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs text-[#b9b7af] transition-colors hover:bg-white/[0.03] disabled:opacity-60"
              >
                <SlidersHorizontal className="size-3.5 text-[#87867c]" />
                <span className="min-w-0 flex-1 truncate">
                  {providerMeta.label} <span className="text-[#6f6d66]">·</span>{" "}
                  {selectedCredential?.title ?? "Choose credential"}{" "}
                  <span className="text-[#6f6d66]">·</span>{" "}
                  {model.startsWith("models/")
                    ? model.slice("models/".length)
                    : model}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 transition-transform",
                    configOpen && "rotate-180",
                  )}
                />
              </button>

              {configOpen && (
                <div
                  id="agent-configuration"
                  className="grid gap-3 border-t border-white/10 px-4 py-3 sm:grid-cols-3"
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="agent-provider"
                      className="flex items-center gap-2 text-[11px] text-[#a4a29a]"
                    >
                      Provider
                    </Label>
                    <div className="relative">
                      <Image
                        src={providerMeta.logo}
                        alt=""
                        width={18}
                        height={18}
                        unoptimized
                        className="pointer-events-none absolute left-3 top-1/2 z-10 size-[18px] -translate-y-1/2"
                      />
                      <select
                        id="agent-provider"
                        value={provider}
                        onChange={(event) =>
                          setProvider(event.target.value as ProviderId)
                        }
                        disabled={isStreaming}
                        className={cn(FIELD_CLASS, "rounded-xl pl-10")}
                      >
                        {PROVIDER_ORDER.map((id) => (
                          <option key={id} value={id}>
                            {PROVIDERS[id].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="agent-credential"
                      className="flex items-center gap-2 text-[11px] text-[#a4a29a]"
                    >
                      <KeyRound className="size-3.5 text-[#87867c]" />
                      Credential
                    </Label>
                    <select
                      id="agent-credential"
                      value={credentialId}
                      onChange={(event) => setCredentialId(event.target.value)}
                      disabled={
                        isLoadingCredentials ||
                        providerCredentials.length === 0 ||
                        isStreaming
                      }
                      className={cn(FIELD_CLASS, "rounded-xl")}
                    >
                      {providerCredentials.length === 0 ? (
                        <option value="">
                          {isLoadingCredentials
                            ? "Loading credentials…"
                            : `No ${providerMeta.label} credentials`}
                        </option>
                      ) : (
                        providerCredentials.map((credential) => (
                          <option key={credential.id} value={credential.id}>
                            {credential.title}
                          </option>
                        ))
                      )}
                    </select>
                    {credentialsError ? (
                      <p className="text-[11px] text-red-400">
                        {credentialsError}
                      </p>
                    ) : providerCredentials.length === 0 &&
                      !isLoadingCredentials ? (
                      <Link
                        href={`/home/credentials?platform=${provider === "google" ? "gemini" : provider}&openCreate=1`}
                        className="inline-block text-[11px] text-[#F04D26] underline hover:text-[#F04D26]/90"
                      >
                        Add a {providerMeta.label} credential
                      </Link>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="agent-model"
                      className="flex items-center gap-2 text-[11px] text-[#a4a29a]"
                    >
                      <Cpu className="size-3.5 text-[#87867c]" />
                      Model
                    </Label>
                    <select
                      id="agent-model"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      disabled={isStreaming}
                      className={cn(FIELD_CLASS, "rounded-xl")}
                    >
                      {providerMeta.models.map((option) => (
                        <option key={option} value={option}>
                          {option.startsWith("models/")
                            ? option.slice("models/".length)
                            : option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="relative px-3 pb-3">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder={
                    credentialId
                      ? "Send a message… (Enter to send, Shift+Enter for newline)"
                      : "Add or select a credential to start chatting"
                  }
                  disabled={!credentialId || isStreaming}
                  className="min-h-[56px] max-h-48 w-full resize-y bg-transparent px-2 py-3 pr-14 text-sm text-white outline-none placeholder:text-[#77756e] disabled:cursor-not-allowed disabled:opacity-60"
                />
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    disabled={isAborting}
                    aria-label={
                      isAborting ? "Stopping response" : "Stop response"
                    }
                    title={isAborting ? "Stopping response" : "Stop response"}
                    className="absolute bottom-4 right-4 flex size-9 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-white/85 disabled:cursor-wait disabled:opacity-70"
                  >
                    {isAborting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Square className="size-3.5 fill-current" />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                    aria-label="Send message"
                    title="Send message"
                    className="absolute bottom-4 right-4 flex size-9 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:bg-[#454545] disabled:text-[#8a8a8a]"
                  >
                    <Send className="size-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-[#6f6d66]">
              AI can make mistakes. Check workflow changes before running them.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
