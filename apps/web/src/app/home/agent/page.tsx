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
  BotMessageSquareIcon,
  CheckCircle2,
  Cpu,
  Eraser,
  KeyRound,
  Loader2,
  Send,
  Square,
  Terminal,
  UserRound,
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
import { Input } from "@/components/ui/input";
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
  receivedAt: number;
  chunk: AgentStreamChunk;
};
type RunMeta = {
  agentRunId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
};

const PRIMARY_BUTTON =
  "bg-[#F04D26] text-white hover:bg-[#F04D26]/90 disabled:opacity-60";
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

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
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

function buildHistory(messages: AgentMessage[]): AgentChatRequestBody["messages"] {
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

function ProviderButton({
  meta,
  active,
  disabled,
  onClick,
}: {
  meta: ProviderMeta;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "border-[#F04D26]/60 bg-[#F04D26]/10 text-white"
          : "border-[#333333] bg-[#1a1a1a] text-[#a4a29a] hover:border-[#4a4a4a] hover:text-white",
      )}
    >
      <Image src={meta.logo} alt="" width={18} height={18} unoptimized />
      {meta.label}
    </button>
  );
}

function ToolCall({ part }: { part: ToolPart }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-200">
          <Wrench className="size-3.5" />
          {part.name}
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#7c7a72]">
          {part.state === "streaming"
            ? "running"
            : part.state === "error"
              ? "failed"
              : "done"}
        </span>
      </div>
      {part.input !== undefined && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[#b9b7af]">
          {stringify(part.input)}
        </pre>
      )}
      {part.output !== undefined && (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-white/[0.06] pt-2 text-[11px] leading-relaxed text-emerald-200/80">
          {stringify(part.output)}
        </pre>
      )}
      {part.errorText && (
        <p className="mt-2 text-[11px] text-red-300">{part.errorText}</p>
      )}
    </div>
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

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-1",
          isUser
            ? "bg-white/10 text-[#c9c7bf] ring-white/15"
            : "bg-[#F04D26]/15 text-[#F04D26] ring-[#F04D26]/30",
        )}
      >
        {isUser ? (
          <UserRound className="size-4" />
        ) : (
          <BotMessageSquareIcon className="size-4" />
        )}
      </span>
      <div
        className={cn(
          "min-w-0 max-w-[85%] space-y-2",
          isUser && "flex flex-col items-end",
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
                  "whitespace-pre-wrap break-words rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                  isUser
                    ? "bg-[#F04D26] text-white"
                    : "border border-white/10 bg-[#1d1d1d] text-[#e8e6e1]",
                )}
              >
                {part.text}
              </div>
            ) : null
          ) : part.type === "error" ? (
            <AgentErrorPartView
              key={`${part.type}-${part.id}`}
              part={part}
            />
          ) : (
            <ToolCall key={`${part.type}-${part.id}`} part={part} />
          ),
        )}
      </div>
    </div>
  );
}

function EventsPanel({
  events,
  onClear,
}: {
  events: AgentEvent[];
  onClear: () => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = listRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [events]);

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a]">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-[#F04D26]" />
          <h2 className="text-sm font-medium text-white">Events</h2>
          <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-[#b0aea6]">
            {events.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={events.length === 0}
          aria-label="Clear events"
          className="flex size-7 items-center justify-center rounded-md text-[#87867c] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          <Eraser className="size-3.5" />
        </button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {events.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-[#6f6d66]">
            Stream events from the agent will appear here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {events.map((event) => (
              <li
                key={event.id}
                className="rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "truncate font-mono text-[10px] font-medium",
                      eventTone(event.chunk.type),
                    )}
                  >
                    {event.chunk.type}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-[#6f6d66]">
                    {formatTime(event.receivedAt)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-[#a4a29a]">
                  {describeEvent(event.chunk)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
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
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAborting, setIsAborting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [runMeta, setRunMeta] = useState<RunMeta | null>(null);

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
        logAgentUiError("Failed to load credentials", err, { scope: "credentials" });
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
  }, [messages, isStreaming]);

  const updateAssistant = useCallback(
    (
      assistantId: string,
      updater: (parts: AgentPart[]) => AgentPart[],
    ) => {
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
      setEvents((current) => [
        ...current.slice(-499),
        { id: nextId("event"), receivedAt: Date.now(), chunk },
      ]);

      switch (chunk.type) {
        case "start": {
          const metadata = isRecord(chunk.messageMetadata)
            ? chunk.messageMetadata
            : undefined;
          const agentRunId = metadata ? readString(metadata.agentRunId) : undefined;
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
              return [
                ...parts,
                { type: "text", id: partId, text: delta },
              ];
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
          const toolCallId =
            readString(chunk.toolCallId) ?? nextId("tool");
          const name = readString(chunk.toolName) ?? "tool";
          updateAssistant(assistantId, (parts) =>
            parts.some(
              (part) => part.type === "tool" && part.id === toolCallId,
            )
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
          const usage = metadata && isRecord(metadata.tokenUsage)
            ? metadata.tokenUsage
            : undefined;
          const agentRunId = metadata
            ? readString(metadata.agentRunId)
            : undefined;
          if (agentRunId) agentRunIdRef.current = agentRunId;
          setRunMeta({
            agentRunId,
            inputTokens: usage ? readNumber(usage.inputTokens) : undefined,
            outputTokens: usage ? readNumber(usage.outputTokens) : undefined,
            totalTokens: usage ? readNumber(usage.totalTokens) : undefined,
            durationMs: metadata ? readNumber(metadata.durationMs) : undefined,
          });
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
    setEvents([]);
    setNotice(null);
    setRunMeta(null);
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
    setRunMeta(null);
    agentRunIdRef.current = null;
  }

  const canSend =
    Boolean(input.trim()) &&
    Boolean(credentialId) &&
    Boolean(model.trim()) &&
    !isStreaming;
  const datalistId = `agent-models-${provider}`;

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl tracking-tight text-white">
              AI Agent
            </h1>
            <p className="mt-1 text-sm text-[#87867c]">
              Chat with your workflow assistant and inspect every stream event.
            </p>
          </div>
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

        <section className="rounded-xl border border-white/10 bg-[#1a1a1a] p-4">
          <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label className="text-[#87867c]">Provider</Label>
              <div className="flex flex-wrap gap-2">
                {PROVIDER_ORDER.map((id) => (
                  <ProviderButton
                    key={id}
                    meta={PROVIDERS[id]}
                    active={provider === id}
                    disabled={isStreaming}
                    onClick={() => setProvider(id)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-credential" className="text-[#87867c]">
                Credential
              </Label>
              <select
                id="agent-credential"
                value={credentialId}
                onChange={(event) => setCredentialId(event.target.value)}
                disabled={isLoadingCredentials || providerCredentials.length === 0}
                className={FIELD_CLASS}
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
                <p className="text-xs text-red-400">{credentialsError}</p>
              ) : providerCredentials.length === 0 && !isLoadingCredentials ? (
                <p className="text-xs text-[#87867c]">
                  <Link
                    href={`/home/credentials?platform=${provider === "google" ? "gemini" : provider}&openCreate=1`}
                    className="text-[#F04D26] underline hover:text-[#F04D26]/90"
                  >
                    Add a {providerMeta.label} credential
                  </Link>
                </p>
              ) : selectedCredential ? (
                <p className="text-xs text-[#6f6d66]">
                  Using saved {providerMeta.label} credential
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-model" className="text-[#87867c]">
                Model
              </Label>
              <Input
                id="agent-model"
                list={datalistId}
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="Enter or pick a model"
                className="border-[#333333] bg-[#151515] focus-visible:border-[#F04D26]/70 focus-visible:ring-[#F04D26]/40"
              />
              <datalist id={datalistId}>
                {providerMeta.models.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <p className="text-xs text-[#6f6d66]">
                Pick a suggested model or type a custom one.
              </p>
            </div>
          </div>
        </section>

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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex h-[calc(100svh-21rem)] min-h-[420px] flex-col rounded-xl border border-white/10 bg-[#1a1a1a]">
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
              <div className="flex items-center gap-2">
                <BotMessageSquareIcon className="size-4 text-[#F04D26]" />
                <h2 className="text-sm font-medium text-white">Conversation</h2>
                {isStreaming && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-sky-300">
                    <span className="size-1.5 animate-pulse rounded-full bg-sky-400" />
                    {isAborting ? "Stopping…" : "Streaming"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {isStreaming && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleStop}
                    disabled={isAborting}
                    className="h-7 border border-[#444444] bg-[#242424] text-[#e8e6e1] hover:bg-[#2d2d2d] hover:text-white"
                  >
                    {isAborting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Square className="size-3.5" />
                    )}
                    {isAborting ? "Stopping" : "Stop"}
                  </Button>
                )}
                {runMeta && (
                  <div className="hidden items-center gap-3 text-[11px] text-[#6f6d66] sm:flex">
                    {runMeta.totalTokens !== undefined && (
                      <span className="inline-flex items-center gap-1">
                        <Cpu className="size-3" />
                        {runMeta.totalTokens} tokens
                      </span>
                    )}
                    {runMeta.durationMs !== undefined && (
                      <span>{runMeta.durationMs} ms</span>
                    )}
                    {runMeta.agentRunId && (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-400" />
                        {runMeta.agentRunId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div
              ref={messageListRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-[#F04D26]/10 text-[#F04D26] ring-1 ring-[#F04D26]/25">
                    <BotMessageSquareIcon className="size-6" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Ask about your workflows
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-[#87867c]">
                      List, validate, create, update, run, or delete workflows.
                      Select a provider, credential, and model to begin.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 p-3">
              <div className="flex items-end gap-2">
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
                  className="min-h-[52px] max-h-40 w-full resize-y rounded-lg border border-[#333333] bg-[#151515] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#6b6b68] focus-visible:border-[#F04D26]/70 focus-visible:ring-1 focus-visible:ring-[#F04D26]/40 disabled:cursor-not-allowed disabled:opacity-60"
                />
                {isStreaming ? (
                  <Button
                    type="button"
                    onClick={handleStop}
                    disabled={isAborting}
                    className="h-10 shrink-0 border border-[#333333] bg-[#1d1d1d] text-[#e8e6e1] hover:bg-[#242424] hover:text-white"
                  >
                    {isAborting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Square className="size-4" />
                    )}
                    {isAborting ? "Stopping" : "Stop"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                    className={cn(PRIMARY_BUTTON, "h-10 shrink-0")}
                  >
                    <Send className="size-4" />
                    Send
                  </Button>
                )}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#6f6d66]">
                <KeyRound className="size-3" />
                Requests run on the server with your selected saved credential.
              </p>
            </div>
          </section>

          <div className="h-[420px] lg:h-[calc(100svh-21rem)] lg:min-h-[420px]">
            <EventsPanel events={events} onClear={() => setEvents([])} />
          </div>
        </div>
      </div>
    </div>
  );
}
