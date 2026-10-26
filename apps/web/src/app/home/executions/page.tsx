"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Square } from "lucide-react";
import { getNodeDef } from "@WorkOrchestrator/shared/nodeRegistry";
import {
  api,
  type WorkflowRunSummary,
  type WorkflowStatus,
  type WorkflowSummary,
  type WorkflowUsage,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ExecutionTab = "All" | WorkflowRunSummary["status"];

const TABS: ExecutionTab[] = [
  "All",
  "Pending",
  "Running",
  "Success",
  "Failure",
  "Cancelled",
];

const STATUS_LABELS: Record<WorkflowRunSummary["status"], string> = {
  Pending: "Queued",
  Running: "Running",
  Success: "Success",
  Failure: "Failure",
  Cancelled: "Cancelled",
};

const NODE_STATUS_DOT: Record<string, string> = {
  Pending: "bg-amber-400",
  Running: "bg-sky-400 animate-pulse",
  Success: "bg-emerald-400",
  Failed: "bg-red-400",
  Skipped: "bg-zinc-500",
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(createdAt: string, finishedAt: string | null): string {
  const start = new Date(createdAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "—";
  }

  const totalSeconds = Math.max(0, Math.round((end - start) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatPayload(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function hasPayload(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "object" && Object.keys(value).length === 0) {
    return false;
  }
  return true;
}

function PayloadBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="overflow-hidden rounded-md border border-white/[0.07] bg-black/25">
      <div className="border-b border-white/[0.05] px-2.5 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#6f6d66]">
          {label}
        </span>
      </div>
      <pre className="max-h-52 overflow-auto px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-[#b0aea6]">
        {formatPayload(value)}
      </pre>
    </div>
  );
}

function WorkflowStatusLabel({ status }: { status: WorkflowStatus | null }) {
  return (
    <span className="truncate text-[11px] text-[#6f6d66]">
      {status ? STATUS_LABELS[status] : "No runs"}
    </span>
  );
}

function WorkflowListItem({
  workflow,
  active,
  onSelect,
}: {
  workflow: WorkflowSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F04D26]",
        active
          ? "bg-[#313131] text-white"
          : "text-[#b0aea6] hover:bg-white/[0.06] hover:text-white",
      )}
    >
      <span className="w-full truncate text-[13px] font-medium">
        {workflow.title}
      </span>
      <span className="flex w-full items-center gap-1.5 overflow-hidden text-[11px] text-[#6f6d66]">
        <span className="shrink-0">{workflow.nodeCount} nodes</span>
        <span aria-hidden="true">·</span>
        <WorkflowStatusLabel status={workflow.lastRunStatus} />
      </span>
    </button>
  );
}

function TimelineNode({
  nodeRun,
}: {
  nodeRun: WorkflowRunSummary["nodeRuns"][number];
}) {
  const [showPayload, setShowPayload] = useState(false);
  const payloadAvailable =
    hasPayload(nodeRun.input) || hasPayload(nodeRun.output);

  return (
    <li className="relative py-3">
      <span
        aria-hidden="true"
        className={cn(
          "absolute -left-[20.5px] top-[17px] size-1.5 rounded-full ring-4 ring-[#191919]",
          NODE_STATUS_DOT[nodeRun.status] ?? "bg-white/25",
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[#d1d0ca]">
            {getNodeDef(nodeRun.nodeType)?.label ?? nodeRun.nodeType}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-[#6f6d66]">
            {nodeRun.nodeId}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#6f6d66]">
            {nodeRun.status}
          </p>
          <p className="mt-0.5 text-[10px] tabular-nums text-[#555550]">
            {formatTime(nodeRun.startedAt)}
          </p>
        </div>
      </div>

      {nodeRun.error && (
        <p className="mt-1.5 break-words text-[11px] leading-relaxed text-[#9c9a92]">
          {nodeRun.error}
        </p>
      )}

      {payloadAvailable && (
        <button
          type="button"
          onClick={() => setShowPayload((current) => !current)}
          aria-expanded={showPayload}
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-[#6f6d66] transition-colors hover:text-[#d1d0ca]"
        >
          {showPayload ? "Hide payload" : "Show payload"}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3 transition-transform",
              showPayload && "rotate-180",
            )}
          />
        </button>
      )}

      {showPayload && (
        <div className="mt-2 space-y-2">
          {hasPayload(nodeRun.input) && (
            <PayloadBlock label="Input" value={nodeRun.input} />
          )}
          {hasPayload(nodeRun.output) && (
            <PayloadBlock label="Output" value={nodeRun.output} />
          )}
        </div>
      )}
    </li>
  );
}

function RunTimeline({ run }: { run: WorkflowRunSummary }) {
  if (run.nodeRuns.length === 0) {
    return (
      <p className="py-3 text-xs text-[#6f6d66]">
        No node activity was recorded for this run.
      </p>
    );
  }

  return (
    <ol className="ml-1 border-l border-white/[0.08] pl-4">
      {run.nodeRuns.map((nodeRun) => (
        <TimelineNode key={nodeRun.id} nodeRun={nodeRun} />
      ))}
    </ol>
  );
}

function RunRow({
  run,
  expanded,
  onToggle,
  onCancel,
  isCancelling,
}: {
  run: WorkflowRunSummary;
  expanded: boolean;
  onToggle: () => void;
  onCancel: () => void;
  isCancelling: boolean;
}) {
  const failedNodes = run.nodeRuns.filter(
    (nodeRun) => nodeRun.status === "Failed",
  ).length;

  return (
    <li
      className={cn(
        "relative border-b border-white/[0.06] transition-colors",
        expanded && "border-white/[0.1]",
      )}
    >
      {expanded && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-px bg-[#F04D26]"
        />
      )}
      <div className="flex items-center gap-2 pr-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="group flex min-w-0 flex-1 items-center justify-between gap-4 py-3 pl-3 text-left"
        >
          <span className="min-w-0">
            <span className="block truncate font-mono text-xs text-[#d1d0ca]">
              Run {run.id.slice(0, 8)}
            </span>
            <span className="mt-1 block text-[11px] text-[#6f6d66]">
              {formatDateTime(run.createdAt)}
              <span aria-hidden="true"> · </span>
              {run.status === "Pending"
                ? `Queued for ${formatDuration(run.createdAt, run.finishedAt)}`
                : run.status === "Running"
                  ? `Running for ${formatDuration(run.createdAt, run.finishedAt)}`
                  : formatDuration(run.createdAt, run.finishedAt)}
              <span aria-hidden="true"> · </span>
              {run.nodeRuns.length} nodes
              {failedNodes > 0 && (
                <>
                  <span aria-hidden="true"> · </span>
                  {failedNodes} failed
                </>
              )}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#6f6d66]">
              {STATUS_LABELS[run.status]}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-3.5 transition-transform group-hover:text-[#b0aea6]",
                expanded ? "rotate-180 text-[#F04D26]" : "text-[#555550]",
              )}
            />
          </span>
        </button>
        {run.status === "Pending" && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            aria-label={`Cancel run ${run.id.slice(0, 8)}`}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/10 px-2 text-[11px] text-[#b0aea6] transition-colors hover:border-red-400/40 hover:text-red-300 disabled:cursor-wait disabled:opacity-50"
          >
            <Square aria-hidden="true" className="size-3" />
            {isCancelling ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>

      {expanded && (
        <div className="space-y-4 px-3 pb-4">
          {hasPayload(run.metadata) && (
            <PayloadBlock label="Run payload" value={run.metadata} />
          )}
          {hasPayload(run.errorMetadata) && (
            <PayloadBlock label="Error metadata" value={run.errorMetadata} />
          )}
          <RunTimeline run={run} />
        </div>
      )}
    </li>
  );
}

export default function ExecutionsPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);
  const [workflowsRefreshKey, setWorkflowsRefreshKey] = useState(0);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    null,
  );

  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null);
  const [runsRefreshKey, setRunsRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<ExecutionTab>("All");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [usage, setUsage] = useState<WorkflowUsage | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .workflowUsage()
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setWorkflowsLoading(true);
    setWorkflowsError(null);

    api
      .workflows()
      .then((data) => {
        if (cancelled) return;
        setWorkflows(data);
        setSelectedWorkflowId((current) => {
          if (current && data.some((workflow) => workflow.id === current)) {
            return current;
          }
          return data[0]?.id ?? null;
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setWorkflowsError(
          error instanceof Error ? error.message : "Failed to load workflows.",
        );
        setWorkflows([]);
        setSelectedWorkflowId(null);
      })
      .finally(() => {
        if (!cancelled) setWorkflowsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workflowsRefreshKey]);

  useEffect(() => {
    if (!selectedWorkflowId) {
      setRuns([]);
      setRunsError(null);
      setRunsLoading(false);
      return;
    }

    let cancelled = false;
    setRuns([]);
    setRunsLoading(true);
    setRunsError(null);
    setExpandedRunId(null);

    const loadRuns = async () => {
      const allRuns: WorkflowRunSummary[] = [];
      let cursor: string | undefined;
      do {
        const response = await api.workflowRuns({
          workflowId: selectedWorkflowId,
          limit: 50,
          ...(cursor ? { cursor } : {}),
        });
        allRuns.push(...response.workflowRuns);
        cursor = response.nextCursor;
      } while (cursor);
      return allRuns;
    };

    loadRuns()
      .then((loadedRuns) => {
        if (!cancelled) setRuns(loadedRuns);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRunsError(
          error instanceof Error ? error.message : "Failed to load executions.",
        );
        setRuns([]);
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [runsRefreshKey, selectedWorkflowId]);

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId),
    [selectedWorkflowId, workflows],
  );

  const counts = useMemo(() => {
    const result: Record<ExecutionTab, number> = {
      All: runs.length,
      Pending: 0,
      Running: 0,
      Success: 0,
      Failure: 0,
      Cancelled: 0,
    };
    for (const run of runs) {
      result[run.status] += 1;
    }
    return result;
  }, [runs]);

  const visibleRuns = useMemo(
    () =>
      activeTab === "All"
        ? runs
        : runs.filter((run) => run.status === activeTab),
    [activeTab, runs],
  );

  async function handleCancelRun(runId: string) {
    setCancellingRunId(runId);
    setCancelError(null);
    try {
      await api.cancelWorkflowRun(runId);
      setRunsRefreshKey((current) => current + 1);
      setWorkflowsRefreshKey((current) => current + 1);
    } catch (error) {
      setCancelError(
        error instanceof Error ? error.message : "Failed to cancel execution.",
      );
    } finally {
      setCancellingRunId(null);
    }
  }

  useEffect(() => {
    if (counts.Pending === 0 && counts.Running === 0) return;
    const timer = window.setInterval(() => {
      setRunsRefreshKey((current) => current + 1);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [counts.Pending, counts.Running]);

  return (
    <div className="flex h-[calc(100svh-4rem)] min-h-0 w-full flex-col px-4 pb-4 md:px-6">
      <header className="shrink-0 py-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
          Executions
        </h1>
        <p className="mt-1 text-xs text-[#6f6d66]">
          {usage?.runCount ?? 0}/{usage?.limit ?? 1000} executions this month
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <aside className="flex max-h-[42svh] w-full shrink-0 flex-col overflow-hidden rounded-xl bg-[#1a1a1a] lg:max-h-none lg:w-[18rem]">
          <div className="shrink-0 px-4 pb-2 pt-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#6f6d66]">
              Workflows
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {workflowsError ? (
              <div className="m-1 rounded-md border border-white/10 px-3 py-3">
                <p className="text-xs text-[#b0aea6]">{workflowsError}</p>
                <button
                  type="button"
                  onClick={() =>
                    setWorkflowsRefreshKey((current) => current + 1)
                  }
                  className="mt-2 text-[11px] text-[#d1d0ca] underline-offset-2 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : workflowsLoading ? (
              <p className="px-3 py-4 text-xs text-[#6f6d66]">Loading…</p>
            ) : workflows.length === 0 ? (
              <div className="px-3 py-8">
                <p className="text-xs text-[#b0aea6]">No workflows yet</p>
                <Link
                  href="/home"
                  className="mt-2 inline-flex text-[11px] text-[#d1d0ca] underline-offset-2 hover:underline"
                >
                  Create your first workflow
                </Link>
              </div>
            ) : (
              <div className="space-y-0.5">
                {workflows.map((workflow) => (
                  <WorkflowListItem
                    key={workflow.id}
                    workflow={workflow}
                    active={workflow.id === selectedWorkflowId}
                    onSelect={() => {
                      setSelectedWorkflowId(workflow.id);
                      setActiveTab("All");
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-[#191919]">
          {selectedWorkflow ? (
            <>
              <div className="flex shrink-0 items-center gap-5 overflow-x-auto border-b border-white/10 px-4 md:px-6">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b text-xs transition-colors",
                        isActive
                          ? "border-[#F04D26] text-white"
                          : "border-transparent text-[#6f6d66] hover:text-[#b0aea6]",
                      )}
                    >
                      {tab}
                      <span className="text-[10px] tabular-nums text-[#555550]">
                        {counts[tab]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 md:px-6">
                {cancelError && (
                  <p role="alert" className="mt-3 text-xs text-red-300">
                    {cancelError}
                  </p>
                )}
                {runsError ? (
                  <div className="mt-4 rounded-md border border-white/10 px-3 py-3">
                    <p className="text-xs text-[#b0aea6]">{runsError}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setRunsRefreshKey((current) => current + 1)
                      }
                      className="mt-2 text-[11px] text-[#d1d0ca] underline-offset-2 hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : runsLoading ? (
                  <p className="py-6 text-xs text-[#6f6d66]">Loading…</p>
                ) : visibleRuns.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-[#b0aea6]">
                      {runs.length === 0
                        ? "No executions yet"
                        : `No ${activeTab.toLowerCase()} executions`}
                    </p>
                    <p className="mt-1 text-xs text-[#6f6d66]">
                      {runs.length === 0
                        ? "Run this workflow to see its execution history here."
                        : "Choose another status to see other runs."}
                    </p>
                  </div>
                ) : (
                  <ul>
                    {visibleRuns.map((run) => (
                      <RunRow
                        key={run.id}
                        run={run}
                        expanded={expandedRunId === run.id}
                        onCancel={() => void handleCancelRun(run.id)}
                        isCancelling={cancellingRunId === run.id}
                        onToggle={() =>
                          setExpandedRunId((current) =>
                            current === run.id ? null : run.id,
                          )
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center px-6">
              <div className="text-center">
                <p className="text-sm text-[#b0aea6]">
                  {workflowsLoading
                    ? "Loading workflows"
                    : workflows.length === 0
                      ? "No workflows available"
                      : "Select a workflow"}
                </p>
                <p className="mt-1 text-xs text-[#6f6d66]">
                  {workflows.length === 0 && !workflowsLoading
                    ? "Create a workflow to start tracking executions."
                    : "Choose a workflow on the left to review its executions."}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
