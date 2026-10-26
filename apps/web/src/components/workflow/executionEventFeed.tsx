"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Copy,
  Loader2,
  MinusCircle,
  Radio,
  Terminal,
  XCircle,
} from "lucide-react";
import { getNodeDef } from "@WorkOrchestrator/shared/nodeRegistry";
import { cn } from "@/lib/utils";
import type {
  ExecutionStreamEvent,
  ExecutionStreamState,
} from "@/lib/execution/stream";
import { getNodeIcon } from "./nodeIcons";

type StatusTone =
  "success" | "error" | "running" | "pending" | "skipped" | "neutral";

const TONE_STYLES: Record<StatusTone, string> = {
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  error: "border-red-400/25 bg-red-400/10 text-red-300",
  running: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  pending: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  skipped: "border-white/10 bg-white/[0.04] text-[#b0aea6]",
  neutral: "border-white/10 bg-white/[0.04] text-[#b0aea6]",
};

const DOT_STYLES: Record<StatusTone, string> = {
  success: "bg-emerald-400",
  error: "bg-red-400",
  running: "bg-sky-400 animate-pulse",
  pending: "bg-amber-400",
  skipped: "bg-zinc-500",
  neutral: "bg-white/30",
};

const STATE_META: Record<
  ExecutionStreamState | "idle",
  { label: string; dot: string }
> = {
  idle: { label: "Idle", dot: "bg-white/30" },
  connecting: { label: "Connecting", dot: "bg-sky-400 animate-pulse" },
  connected: { label: "Live", dot: "bg-emerald-400 animate-pulse" },
  reconnecting: { label: "Reconnecting", dot: "bg-amber-400 animate-pulse" },
  finished: { label: "Finished", dot: "bg-white/40" },
};

function getTone(event: ExecutionStreamEvent): StatusTone {
  if (typeof event.error === "string" && event.error.trim().length > 0) {
    return "error";
  }

  const status =
    typeof event.status === "string" ? event.status.toLowerCase() : "";

  if (
    status === "success" ||
    status === "succeeded" ||
    status === "completed"
  ) {
    return "success";
  }
  if (status === "failed" || status === "failure" || status === "error") {
    return "error";
  }
  if (
    status === "running" ||
    status === "in_progress" ||
    status === "in-progress"
  ) {
    return "running";
  }
  if (status === "pending" || status === "queued") {
    return "pending";
  }
  if (status === "skipped" || status === "cancelled" || status === "canceled") {
    return "skipped";
  }
  return "neutral";
}

function getStatusLabel(event: ExecutionStreamEvent, tone: StatusTone): string {
  switch (tone) {
    case "success":
      return "Success";
    case "error":
      return "Failed";
    case "running":
      return "Running";
    case "pending":
      return "Pending";
    case "skipped":
      return typeof event.status === "string" ? event.status : "Skipped";
    default:
      return typeof event.status === "string" ? event.status : "Event";
  }
}

function StatusIcon({
  tone,
  className = "size-3.5",
}: {
  tone: StatusTone;
  className?: string;
}) {
  switch (tone) {
    case "success":
      return <CheckCircle2 className={className} />;
    case "error":
      return <XCircle className={className} />;
    case "running":
      return <Loader2 className={`${className} animate-spin`} />;
    case "pending":
      return <Clock3 className={className} />;
    case "skipped":
      return <MinusCircle className={className} />;
    default:
      return <Circle className={className} />;
  }
}

function StatusPill({
  tone,
  label,
  className = "",
}: {
  tone: StatusTone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        TONE_STYLES[tone],
        className,
      )}
    >
      <StatusIcon tone={tone} className="size-2.5" />
      {label}
    </span>
  );
}

function getEventTitle(event: ExecutionStreamEvent): string {
  if (event.type === "workflow") return "Workflow run";
  if (event.type === "node") {
    const nodeType = typeof event.nodeType === "string" ? event.nodeType : "";
    return getNodeDef(nodeType)?.label ?? (nodeType || "Node");
  }
  return event.type;
}

function getEventTime(event: ExecutionStreamEvent): string {
  if (
    typeof event.timestamp !== "number" ||
    !Number.isFinite(event.timestamp)
  ) {
    return "—";
  }
  return new Date(event.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getEventTitleTimestamp(
  event: ExecutionStreamEvent,
): string | undefined {
  if (
    typeof event.timestamp !== "number" ||
    !Number.isFinite(event.timestamp)
  ) {
    return undefined;
  }
  return new Date(event.timestamp).toLocaleString();
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function JsonPanel({ label, value }: { label: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);
  const text = stringifyValue(value);

  useEffect(() => {
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="border-t border-white/[0.06] bg-black/25">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.05] px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#7c7a72]">
          {label}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-[#87867c] transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check className="size-3 text-emerald-400" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-56 overflow-auto px-3 py-2 font-mono text-[10.5px] leading-relaxed text-[#b0aea6]">
        {text}
      </pre>
    </div>
  );
}

function EventCard({
  event,
  isLast,
}: {
  event: ExecutionStreamEvent;
  isLast: boolean;
}) {
  const [openPanel, setOpenPanel] = useState<"output" | "raw" | null>(null);
  const tone = getTone(event);
  const isWorkflow = event.type === "workflow";
  const nodeType = typeof event.nodeType === "string" ? event.nodeType : "";
  const nodeId = typeof event.nodeId === "string" ? event.nodeId : null;
  const hasOutput = event.output !== undefined && event.output !== null;
  const hasError =
    typeof event.error === "string" && event.error.trim().length > 0;

  const togglePanel = (panel: "output" | "raw") => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  return (
    <li
      className={cn(
        "group flex gap-2.5 last:pb-0",
        isWorkflow ? "pb-3" : "pb-1.5",
      )}
    >
      <div className="relative flex w-2 shrink-0 justify-center">
        <span
          aria-hidden="true"
          title={getStatusLabel(event, tone)}
          className={cn(
            "mt-[18px] size-2 shrink-0 rounded-full",
            DOT_STYLES[tone],
            isWorkflow && "ring-4 ring-white/[0.06]",
          )}
        />
        {!isLast && !isWorkflow && (
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-[26px] -bottom-6 w-px -translate-x-1/2 bg-white/[0.12]"
          />
        )}
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 overflow-hidden rounded-lg border transition-colors",
          isWorkflow
            ? "border-white/[0.16] bg-[#1c1c1c] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] group-hover:border-white/[0.22] group-hover:bg-[#212121]"
            : "border-white/[0.07] bg-black/20 group-hover:border-white/[0.12] group-hover:bg-black/30",
        )}
      >
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]"
            aria-hidden="true"
          >
            {isWorkflow ? (
              <Activity className="size-3.5 text-[#d1d0ca]" />
            ) : (
              getNodeIcon(nodeType, 15)
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[13px] font-medium text-white">
                    {getEventTitle(event)}
                  </p>
                  {isWorkflow && (
                    <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-px text-[9px] font-medium uppercase tracking-[0.12em] text-[#b0aea6]">
                      Workflow
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10.5px] text-[#7f7d75]">
                  {nodeId && (
                    <>
                      <span className="truncate font-mono" title={nodeId}>
                        {nodeId}
                      </span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <time
                    className="shrink-0 tabular-nums"
                    title={getEventTitleTimestamp(event)}
                    suppressHydrationWarning
                  >
                    {getEventTime(event)}
                  </time>
                </div>
              </div>
              <StatusPill tone={tone} label={getStatusLabel(event, tone)} />
            </div>

            {hasError && (
              <p className="mt-1.5 break-words text-[11px] leading-relaxed text-red-300/90">
                {event.error}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 border-t border-white/[0.06] px-2.5 py-1">
          {hasOutput && (
            <button
              type="button"
              onClick={() => togglePanel("output")}
              aria-expanded={openPanel === "output"}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                openPanel === "output"
                  ? "bg-white/[0.08] text-white"
                  : "text-[#87867c] hover:bg-white/[0.05] hover:text-white",
              )}
            >
              <Terminal className="size-3" />
              Output
            </button>
          )}
          <button
            type="button"
            onClick={() => togglePanel("raw")}
            aria-expanded={openPanel === "raw"}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              openPanel === "raw"
                ? "bg-white/[0.08] text-white"
                : "text-[#87867c] hover:bg-white/[0.05] hover:text-white",
            )}
          >
            <Terminal className="size-3" />
            Raw event
          </button>
        </div>

        {openPanel === "output" && hasOutput && (
          <JsonPanel label="Node output" value={event.output} />
        )}
        {openPanel === "raw" && <JsonPanel label="Raw event" value={event} />}
      </div>
    </li>
  );
}

export function ExecutionEventFeed({
  events,
  state,
  connectionMessage,
  runId,
}: {
  events: ExecutionStreamEvent[];
  state: ExecutionStreamState | "idle";
  connectionMessage: string | null;
  runId: string;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const [isPinned, setIsPinned] = useState(true);
  const [errorsOnly, setErrorsOnly] = useState(false);

  const workflowEvent = useMemo(
    () =>
      [...events].reverse().find((event) => event.type === "workflow") ?? null,
    [events],
  );
  const errorCount = useMemo(
    () => events.filter((event) => getTone(event) === "error").length,
    [events],
  );
  const visibleEvents = useMemo(
    () =>
      errorsOnly
        ? events.filter((event) => getTone(event) === "error")
        : events,
    [errorsOnly, events],
  );

  const stateMeta = STATE_META[state];
  const runTone: StatusTone = workflowEvent
    ? getTone(workflowEvent)
    : state === "idle" || state === "finished"
      ? "neutral"
      : "running";
  const runLabel = workflowEvent
    ? getStatusLabel(workflowEvent, runTone)
    : state === "idle"
      ? "Idle"
      : state === "finished"
        ? "Finished"
        : "Running";

  useEffect(() => {
    setErrorsOnly(false);
    setIsPinned(true);
  }, [runId]);

  useEffect(() => {
    if (errorCount === 0 && errorsOnly) setErrorsOnly(false);
  }, [errorCount, errorsOnly]);

  useEffect(() => {
    if (!isPinned) return;
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [errorsOnly, isPinned, visibleEvents.length]);

  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const distanceFromBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    setIsPinned(distanceFromBottom < 32);
  }, []);

  const scrollToLatest = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    setIsPinned(true);
  }, []);

  const isWaiting = state === "connecting" || state === "reconnecting";
  const isEmpty = visibleEvents.length === 0;

  const emptyTitle = isWaiting
    ? "Connecting to execution stream"
    : state === "idle"
      ? "No run selected"
      : state === "finished"
        ? "No events were recorded"
        : "Waiting for events";
  const emptyDescription = isWaiting
    ? "Events will appear as soon as the run starts producing them."
    : state === "idle"
      ? "Start a run to stream node activity here."
      : state === "finished"
        ? "This run finished without emitting timeline events."
        : "The run is live. Node activity will appear here.";

  const runHasEnded =
    !errorsOnly &&
    (state === "finished" ||
      (workflowEvent &&
        (getTone(workflowEvent) === "success" ||
          getTone(workflowEvent) === "error")));

  return (
    <section
      aria-label="Workflow run events"
      className="flex h-full min-h-0 flex-col"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
            <Activity className="size-4 text-[#b0aea6]" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-semibold tracking-tight text-white">
              Execution timeline
            </h2>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-[#87867c]">
              <span className="truncate font-mono">
                Run {runId.slice(0, 8)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex shrink-0 items-center gap-1">
                <span className={cn("size-1.5 rounded-full", stateMeta.dot)} />
                {stateMeta.label}
              </span>
            </div>
          </div>
        </div>
        <StatusPill
          tone={runTone}
          label={runLabel}
          className="px-2 py-0.5 text-[11px]"
        />
      </header>

      {connectionMessage && (
        <div
          role="alert"
          className="flex shrink-0 items-start gap-2 border-b border-amber-500/20 bg-amber-500/[0.06] px-4 py-2 text-[11px] leading-relaxed text-amber-200"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          <span className="min-w-0 break-words">{connectionMessage}</span>
        </div>
      )}

      {events.length > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-black/10 px-4 py-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#87867c]">
            <Terminal className="size-3" />
            {errorsOnly
              ? `${visibleEvents.length} of ${events.length} events`
              : `${events.length} event${events.length === 1 ? "" : "s"}`}
          </span>
          {errorCount > 0 && (
            <button
              type="button"
              onClick={() => setErrorsOnly((current) => !current)}
              aria-pressed={errorsOnly}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                errorsOnly
                  ? "bg-red-400/10 text-red-300"
                  : "text-[#87867c] hover:bg-white/[0.05] hover:text-white",
              )}
            >
              <AlertCircle className="size-3" />
              Errors only
              <span
                className={cn(
                  "rounded-full px-1 tabular-nums",
                  errorsOnly
                    ? "bg-red-400/15 text-red-200"
                    : "bg-white/[0.06] text-[#b0aea6]",
                )}
              >
                {errorCount}
              </span>
            </button>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <ol
          ref={listRef}
          onScroll={handleScroll}
          aria-live="polite"
          className="h-full overflow-y-auto px-3 py-3"
        >
          {isEmpty ? (
            <li className="flex h-full min-h-[220px] flex-col items-center justify-center px-4 py-10 text-center">
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-xl border",
                  isWaiting
                    ? "border-sky-400/20 bg-sky-400/[0.06]"
                    : "border-white/10 bg-white/[0.03]",
                )}
              >
                {isWaiting ? (
                  <Loader2 className="size-5 animate-spin text-sky-300" />
                ) : (
                  <Radio className="size-5 text-[#87867c]" />
                )}
              </span>
              <p className="mt-3 text-[13px] font-medium text-[#d1d0ca]">
                {emptyTitle}
              </p>
              <p className="mt-1 max-w-[230px] text-[11px] leading-relaxed text-[#7f7d75]">
                {emptyDescription}
              </p>
            </li>
          ) : (
            <>
              {visibleEvents.map((event, index) => (
                <EventCard
                  key={`${event.type}-${event.nodeId ?? ""}-${event.status ?? ""}-${event.timestamp ?? index}-${index}`}
                  event={event}
                  isLast={index === visibleEvents.length - 1}
                />
              ))}
              {runHasEnded && (
                <li className="flex items-center gap-3 pt-1.5">
                  <span
                    aria-hidden="true"
                    className="h-px flex-1 bg-white/[0.06]"
                  />
                  <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.16em] text-[#6f6d66]">
                    End of run
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-px flex-1 bg-white/[0.06]"
                  />
                </li>
              )}
            </>
          )}
        </ol>

        {!isPinned && visibleEvents.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
            <button
              type="button"
              onClick={scrollToLatest}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#1e1e1e]/95 px-3 py-1.5 text-[11px] text-[#d1d0ca] shadow-lg backdrop-blur transition-colors hover:border-white/20 hover:text-white"
            >
              <ArrowDown className="size-3.5" />
              Jump to latest
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
