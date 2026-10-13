"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { api, type WorkflowStatus, type WorkflowSummary } from "@/lib/api";

const PAGE_SIZE = 6;

const CARD =
  "rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6";
const PAGER =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#333333] bg-[#1d1d1d] px-4 text-sm font-medium text-[#e8e6e1] transition-colors hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-50";

const STATUS_STYLES: Record<
  WorkflowStatus,
  { label: string; className: string }
> = {
  Success: {
    label: "Success",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  Failure: {
    label: "Failed",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
  },
  Pending: {
    label: "Running",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
};

function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function StatusBadge({ status }: { status: WorkflowStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-[#87867c]">
        <span className="size-1.5 rounded-full bg-[#6b6b68]" />
        No runs yet
      </span>
    );
  }

  const style = STATUS_STYLES[status];
  const dot =
    status === "Success"
      ? "bg-emerald-400"
      : status === "Failure"
        ? "bg-red-400"
        : "bg-amber-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.className}`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} />
      {style.label}
    </span>
  );
}

function WorkflowCard({ workflow }: { workflow: WorkflowSummary }) {
  const lastRun = formatDateTime(workflow.lastRunAt);
  const updated = formatDateTime(workflow.updatedAt);

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-[#333333] bg-[#151515] p-4 transition-colors hover:border-[#F04D26]/40">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-semibold text-white">
          {workflow.title}
        </h3>
        <StatusBadge status={workflow.lastRunStatus} />
      </div>

      <div className="flex items-center gap-4 text-xs text-[#87867c]">
        <span>
          <span className="font-medium text-[#c9c9c5]">
            {workflow.nodeCount}
          </span>{" "}
          node{workflow.nodeCount === 1 ? "" : "s"}
        </span>
        <span className="size-1 rounded-full bg-[#3a3a3a]" />
        <span>
          <span className="font-medium text-[#c9c9c5]">
            {workflow.edgeCount}
          </span>{" "}
          edge{workflow.edgeCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-auto space-y-0.5 border-t border-white/5 pt-3 text-[11px] text-[#6b6b68]">
        <p>{lastRun ? `Last run ${lastRun}` : "Never run"}</p>
        <p>Updated {updated ?? "—"}</p>
      </div>
    </article>
  );
}

function WorkflowsSection({ searchQuery }: { searchQuery: string }) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.workflows();
      setWorkflows(data);
      setPage(0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load workflows.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  const filteredWorkflows = workflows.filter((workflow) =>
    workflow.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filteredWorkflows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visible = filteredWorkflows.slice(start, start + PAGE_SIZE);

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight text-white">
            Workflows
          </h2>
          <p className="mt-1 text-sm text-[#87867c]">
            {isLoading
              ? "Loading your workflows…"
              : workflows.length === 0
                ? "No workflows yet."
                : `${filteredWorkflows.length}${searchQuery.trim() ? ` of ${workflows.length}` : ""} workflow${filteredWorkflows.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <div className="mt-5">
        {error ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
            <button type="button" className={PAGER} onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="h-[148px] animate-pulse rounded-xl border border-[#333333] bg-[#151515]"
              />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#87867c]">
            Create your first workflow to see it here.
          </p>
        ) : filteredWorkflows.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#87867c]">
            No workflows match “{searchQuery.trim()}”.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {visible.map((workflow) => (
                <WorkflowCard key={workflow.id} workflow={workflow} />
              ))}
            </div>

            {pageCount > 1 ? (
              <div className="mt-5 flex items-center justify-between gap-4">
                <button
                  type="button"
                  className={PAGER}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={safePage === 0}
                >
                  Previous
                </button>
                <span className="text-xs text-[#87867c]">
                  Page {safePage + 1} of {pageCount}
                </span>
                <button
                  type="button"
                  className={PAGER}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount - 1, current + 1))
                  }
                  disabled={safePage >= pageCount - 1}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div>
      <div className="px-10 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Workflows</h1>
            <p className="text-sm text-[#87867c]">Manage and create your workflow automations</p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#F04D26] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#E63D00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F04D26]"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            Create workflow
          </button>
        </div>
        <label className="relative mt-4 block max-w-xl">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#87867c]"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search workflow"
            aria-label="Search workflow"
            className="h-10 w-100 rounded-lg border border-[#333333] bg-[#151515] pl-9 pr-3 text-sm text-[#87867c] placeholder:text-[#6b6b68] outline-none transition-colors focus:border-[#F04D26]/70 focus:ring-1 focus:ring-[#F04D26]/40"
          />
        </label>
      </div>
      <div className="mx-auto w-full max-w-[880px] space-y-6 px-4 pt-8 md:px-6">
        <WorkflowsSection searchQuery={searchQuery} />
      </div>
    </div>
  );
}
