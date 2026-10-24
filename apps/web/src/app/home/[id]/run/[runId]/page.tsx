"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ExecutionEventFeed } from "@/components/workflow/executionEventFeed";
import { api } from "@/lib/api";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useExecutionStream } from "@/lib/execution/useExecutionStream";
import type { ExecutionStreamEvent } from "@/lib/execution/stream";

type WorkflowRun = Awaited<ReturnType<typeof api.workflowRun>>;

export default function WorkflowRunPage() {
  const { id, runId } = useParams<{ id: string; runId: string }>();
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  usePageTitle(run?.workflow.title ?? "Workflow run");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setRun(null);

    api
      .workflowRun(runId)
      .then((loadedRun) => {
        if (!cancelled) setRun(loadedRun);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Failed to load workflow run.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [runId]);

  const initialEvents = useMemo<ExecutionStreamEvent[]>(() => {
    if (!run) return [];
    return [
      {
        type: "workflow",
        status: run.status,
        timestamp: new Date(run.finishedAt ?? run.createdAt).getTime(),
      },
      ...run.nodeRuns.map((nodeRun) => ({
        type: "node",
        nodeId: nodeRun.nodeId,
        nodeType: nodeRun.nodeType,
        status: nodeRun.status,
        timestamp: new Date(
          nodeRun.completedAt ?? nodeRun.startedAt,
        ).getTime(),
        ...(nodeRun.error ? { error: nodeRun.error } : {}),
        ...(nodeRun.output !== null ? { output: nodeRun.output } : {}),
      })),
    ];
  }, [run]);
  const stream = useExecutionStream(run ? runId : null, initialEvents);
  const currentStatus =
    [...stream.events].reverse().find((event) => event.type === "workflow")
      ?.status ?? run?.status;

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center text-[#87867c]">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading workflow run…
      </div>
    );
  }

  if (loadError || !run) {
    return (
      <div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p role="alert" className="text-sm text-red-300">
          {loadError ?? "Workflow run not found."}
        </p>
        <Link
          href={`/home/${encodeURIComponent(id)}`}
          className="inline-flex items-center gap-2 text-sm text-[#b0aea6] hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to workflow
        </Link>
      </div>
    );
  }

  return (
    <main className="flex h-[calc(100svh-4rem)] min-h-[420px] flex-col bg-[#141414]">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <Link
            href={`/home/${encodeURIComponent(id)}`}
            className="mb-1 inline-flex items-center gap-1 text-xs text-[#87867c] hover:text-white"
          >
            <ArrowLeft className="size-3" />
            {run.workflow.title}
          </Link>
          <h2 className="truncate text-sm font-medium text-white">
            Run {run.id}
          </h2>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#b0aea6]">
          {currentStatus}
        </span>
      </div>
      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-hidden border-x border-white/10 bg-[#171717]">
        <ExecutionEventFeed
          events={stream.events}
          state={stream.state}
          connectionMessage={stream.connectionMessage}
          runId={run.id}
        />
      </div>
    </main>
  );
}