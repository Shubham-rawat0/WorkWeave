"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDotIcon,
  CuboidIcon,
  PlusIcon,
  SearchIcon,
  Share2Icon,
} from "lucide-react";
import { api, type WorkflowStatus, type WorkflowSummary } from "@/lib/api";
import { generateWorkflowName } from "@/lib/utils/randomWorkflowName";

const PAGE_SIZE = 8;

const PAGER =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#333333] bg-[#1d1d1d] px-4 text-sm font-medium text-[#e8e6e1] transition-colors hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-50";

const STATUS_STYLES: Record<
  WorkflowStatus,
  { label: string; text: string }
> = {
  Success: {
    label: "Success",
    text: "text-emerald-400",
  },
  Failure: {
    label: "Failed",
    text: "text-red-400",
  },
  Pending: {
    label: "Running",
    text: "text-amber-400",
  },
};

function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusValue({ status }: { status: WorkflowStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#87867c]">
        <span className="size-1.5 rounded-full bg-[#6b6b68]" />
        No runs
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
      className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${style.text}`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} />
      {style.label}
    </span>
  );
}

function WorkflowCard({ workflow }: { workflow: WorkflowSummary }) {
  const created = formatDateTime(workflow.createdAt);
  const updated = formatDateTime(workflow.updatedAt);

  return (
    <Link
      href={`/home/${workflow.id}`}
      className="group flex w-full flex-col rounded-xl border border-[#333333] bg-[#1a1a1a] p-4 text-left transition-colors hover:border-[#F04D26]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F04D26]"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-inset ring-white/10">
          <CuboidIcon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate text-sm font-semibold text-white">
            {workflow.title}
          </h3>
          <p className="mt-1.5 text-[11px] text-[#87867c]">
            Created {created ?? "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-[#87867c]">
            Updated {updated ?? "—"}
          </p>
        </div>
      </div>

      <div className="my-3.5 h-px w-full bg-white/5" />

      <div className="grid grid-cols-3 divide-x divide-white/5">
        <div className="pr-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#87867c]">
            Node
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-[#c9c9c5]">
            <CircleDotIcon aria-hidden="true" className="size-3.5 text-[#87867c]" />
            {workflow.nodeCount}
          </p>
        </div>
        <div className="px-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#87867c]">
            Edge
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-[#c9c9c5]">
            <Share2Icon aria-hidden="true" className="size-3.5 text-[#87867c]" />
            {workflow.edgeCount}
          </p>
        </div>
        <div className="pl-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#87867c]">
            Status
          </p>
          <p className="mt-1">
            <StatusValue status={workflow.lastRunStatus} />
          </p>
        </div>
      </div>
    </Link>
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
    <section>
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[160px] animate-pulse rounded-xl border border-[#333333] bg-[#1a1a1a]"
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {visible.map((workflow) => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              className={PAGER}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={safePage === 0}
            >
              <ChevronLeftIcon aria-hidden="true" className="size-4" />
              Previous
            </button>
            <span className="inline-flex h-9 items-center justify-center rounded-lg border border-[#333333] bg-[#151515] px-3 text-xs text-[#87867c]">
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
              <ChevronRightIcon aria-hidden="true" className="size-4" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateWorkflow() {
    if (isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const id = crypto.randomUUID();
      const { workflow } = await api.createWorkflow({
        id,
        title: generateWorkflowName(),
        availableTriggerId: "manual",
        triggerMetadata: {},
        actions: [],
        nodes: [],
        edges: [],
      });
      router.push(`/home/${workflow.id}`);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create workflow.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div>
      <div className="px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Workflows</h1>
            <p className="text-sm text-[#87867c]">Manage and create your workflow automations</p>
          </div>
          <button
            type="button"
            onClick={() => void handleCreateWorkflow()}
            disabled={isCreating}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#F04D26] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#E63D00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F04D26]"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            {isCreating ? "Creating..." : "Create workflow"}
          </button>
        </div>
        {createError && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {createError}
          </p>
        )}
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
            className="h-10 w-full rounded-lg border border-[#333333] bg-[#1a1a1a] pl-9 pr-3 text-sm text-[#87867c] placeholder:text-[#87867c] outline-none transition-colors focus:border-[#F04D26]/70 focus:ring-1 focus:ring-[#F04D26]/40"
          />
        </label>
      </div>
      <div className="w-full px-4 pb-8 pt-2 md:px-6">
        <WorkflowsSection searchQuery={searchQuery} />
      </div>
    </div>
  );
}
