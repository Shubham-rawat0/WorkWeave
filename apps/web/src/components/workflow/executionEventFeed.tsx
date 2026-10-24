"use client";

import type {
  ExecutionStreamEvent,
  ExecutionStreamState,
} from "@/lib/execution/stream";

function getEventTitle(event: ExecutionStreamEvent): string {
  if (event.type === "node") {
    return `${typeof event.nodeType === "string" ? event.nodeType : "Node"}${
      typeof event.nodeId === "string" ? ` · ${event.nodeId}` : ""
    }`;
  }
  if (event.type === "workflow") return "Workflow";
  return event.type;
}

function getEventTime(event: ExecutionStreamEvent): string {
  if (typeof event.timestamp !== "number") return "Just now";
  return new Date(event.timestamp).toLocaleTimeString();
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
  return (
    <section
      aria-label="Workflow run events"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Run events</p>
          <p className="truncate text-xs text-[#87867c]">
            Run {runId.slice(0, 8)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${
            state === "connected"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : state === "finished"
                ? "border-white/10 bg-white/5 text-[#b0aea6]"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
          role="status"
        >
          {state === "idle" ? "Waiting" : state}
        </span>
      </div>

      {connectionMessage && (
        <p className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-200">
          {connectionMessage}
        </p>
      )}

      <ol
        aria-live="polite"
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
      >
        {events.length === 0 ? (
          <li className="px-2 py-8 text-center text-sm text-[#87867c]">
            {state === "connecting" || state === "reconnecting"
              ? "Waiting for workflow events…"
              : "No events received yet."}
          </li>
        ) : (
          events.map((event, index) => (
            <li
              key={`${event.timestamp ?? "event"}-${index}`}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-all text-xs font-medium text-white">
                  {getEventTitle(event)}
                </p>
                <time className="shrink-0 text-[10px] text-[#87867c]">
                  {getEventTime(event)}
                </time>
              </div>
              {typeof event.status === "string" && (
                <p className="mt-1 text-xs text-[#b0aea6]">{event.status}</p>
              )}
              {typeof event.error === "string" && (
                <p className="mt-2 break-words text-xs text-red-300">
                  {event.error}
                </p>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-[#87867c] hover:text-white">
                  Event details
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-black/20 p-2 text-[10px] text-[#b0aea6]">
                  {JSON.stringify(event, null, 2)}
                </pre>
              </details>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
