"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type OnEdgesChange,
  type OnNodesChange,
  type Node,
} from "@xyflow/react";
import {
  Activity,
  ChevronDown,
  CloudCheck,
  CloudUpload,
  Loader2,
  Play,
  Plus,
  X,
} from "lucide-react";
import { api, type WebhookEndpoint } from "@/lib/api";
type WorkflowRunsResponse = Awaited<ReturnType<typeof api.workflowRuns>>;
type WorkflowRunSummary = WorkflowRunsResponse["workflowRuns"][number];
import { usePageTitle } from "@/contexts/PageTitleContext";
import { EditorProvider } from "@/contexts/EditorContext";
import WorkflowCanvas from "@/components/workflow/canvas";
import { AddNodeSidebar } from "@/components/workflow/addNodeSidebar";
import { NodeConfigDialog } from "@/components/workflow/dialogs";
import { ExecutionEventFeed } from "@/components/workflow/executionEventFeed";
import { useExecutionStream } from "@/lib/execution/useExecutionStream";
import type { ExecutionStreamBootstrap } from "@/lib/execution/stream";
import { getNodeDef } from "@WorkOrchestrator/shared/nodeRegistry";
import { validateWorkflow } from "@WorkOrchestrator/shared/core";

function getNodeData(node: Node): Record<string, unknown> {
  return node.data && typeof node.data === "object"
    ? (node.data as Record<string, unknown>)
    : {};
}

function isPosition(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { x?: unknown }).x === "number" &&
    typeof (value as { y?: unknown }).y === "number"
  );
}

function toFlowNodes(rawNodes: unknown): Node[] {
  if (!Array.isArray(rawNodes)) {
    return [];
  }

  return rawNodes.flatMap((rawNode, index) => {
    if (!rawNode || typeof rawNode !== "object") {
      return [];
    }

    const node = rawNode as Record<string, unknown>;
    const id = typeof node.id === "string" ? node.id : null;
    if (!id) {
      return [];
    }

    return [
      {
        id,
        type: typeof node.type === "string" ? node.type : "manualTrigger",
        position: isPosition(node.position)
          ? node.position
          : { x: 120 + index * 240, y: 160 },
        data:
          node.data && typeof node.data === "object"
            ? (node.data as Record<string, unknown>)
            : {},
      } satisfies Node,
    ];
  });
}

function toFlowEdges(rawEdges: unknown): Edge[] {
  if (!Array.isArray(rawEdges)) {
    return [];
  }

  return rawEdges.flatMap((rawEdge, index) => {
    if (!rawEdge || typeof rawEdge !== "object") {
      return [];
    }

    const edge = rawEdge as Record<string, unknown>;
    if (typeof edge.source !== "string" || typeof edge.target !== "string") {
      return [];
    }

    return [
      {
        id:
          typeof edge.id === "string"
            ? edge.id
            : `${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        target: edge.target,
        sourceHandle:
          typeof edge.sourceHandle === "string" ? edge.sourceHandle : undefined,
        targetHandle:
          typeof edge.targetHandle === "string" ? edge.targetHandle : undefined,
        data:
          edge.data && typeof edge.data === "object"
            ? (edge.data as Record<string, unknown>)
            : undefined,
      } satisfies Edge,
    ];
  });
}

function getWorkflowSnapshot(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: getNodeData(node),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      data: edge.data ?? null,
    })),
  };
}

function getWorkflowSnapshotKey(nodes: Node[], edges: Edge[]) {
  return JSON.stringify(getWorkflowSnapshot(nodes, edges));
}

type ActionStatus = { type: "success" | "error"; message: string } | null;

type ExecutionStreamEvent = {
  type: string;
  nodeId?: string;
  nodeType?: string;
  status?: string;
  timestamp?: number;
  error?: string;
  output?: unknown;
  [key: string]: unknown;
};

function getRunEvents(run: WorkflowRunSummary): ExecutionStreamEvent[] {
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
      timestamp: new Date(nodeRun.completedAt ?? nodeRun.startedAt).getTime(),
      ...(nodeRun.error ? { error: nodeRun.error } : {}),
      ...(nodeRun.output !== null ? { output: nodeRun.output } : {}),
    })),
  ];
}

function HistoricalRunFeed({ run }: { run: WorkflowRunSummary }) {
  const events = useMemo<ExecutionStreamEvent[]>(
    () => getRunEvents(run),
    [run],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/10 px-4 py-2">
        <p className="text-xs text-[#b0aea6]">Historical run · {run.status}</p>
      </div>
      <div className="min-h-0 flex-1">
        <ExecutionEventFeed
          events={events}
          state={
            run.status === "Success" || run.status === "Failure"
              ? "finished"
              : "idle"
          }
          connectionMessage={null}
          runId={run.id}
        />
      </div>
    </div>
  );
}

export default function WorkflowPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [webhookEndpoints, setWebhookEndpoints] = useState<WebhookEndpoint[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const isSaving = saveStatus === "saving";
  const [isExecuting, setIsExecuting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [streamBootstrap, setStreamBootstrap] =
    useState<ExecutionStreamBootstrap | null>(null);
  const [status, setStatus] = useState<ActionStatus>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [configTarget, setConfigTarget] = useState<{
    nodeId: string;
    nodeType: string;
  } | null>(null);
  const [previousRuns, setPreviousRuns] = useState<WorkflowRunSummary[]>([]);
  const [previousRunsLoading, setPreviousRunsLoading] = useState(false);
  const [previousRunsError, setPreviousRunsError] = useState<string | null>(
    null,
  );
  const [selectedPreviousRunId, setSelectedPreviousRunId] = useState<
    string | null
  >(null);
  const [runHistoryOpen, setRunHistoryOpen] = useState(false);
  const lastPersistedWorkflow = useRef<string | null>(null);
  const loadedWorkflowId = useRef<string | null>(null);
  const persistQueue = useRef<Promise<void>>(Promise.resolve());
  const savedResetTimer = useRef<number | null>(null);
  const activeRun = useMemo(
    () => previousRuns.find((run) => run.id === activeRunId) ?? null,
    [activeRunId, previousRuns],
  );
  const activeRunInitialEvents = useMemo<
    ExecutionStreamEvent[] | undefined
  >(() => {
    if (!activeRun || activeRun.status === "Pending") return undefined;
    return getRunEvents(activeRun);
  }, [activeRun]);
  const executionStream = useExecutionStream(
    activeRunId,
    activeRunInitialEvents,
    streamBootstrap ?? undefined,
  );
  const activeRunStatus = useMemo(() => {
    const workflowEvent = [...executionStream.events]
      .reverse()
      .find((event) => event.type === "workflow");
    if (typeof workflowEvent?.status === "string") {
      return workflowEvent.status;
    }
    return activeRun?.status ?? null;
  }, [activeRun?.status, executionStream.events]);
  const activeRunIsLive =
    Boolean(activeRunId) &&
    executionStream.state !== "finished" &&
    (activeRunStatus === null || activeRunStatus === "Pending");

  usePageTitle(
    loadError ? "Workflow unavailable" : (workflowName ?? "Loading…"),
  );

  useEffect(() => {
    return () => {
      if (savedResetTimer.current) {
        window.clearTimeout(savedResetTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setLoadError(null);
    setStatus(null);
    setConfigTarget(null);
    setPreviousRuns([]);
    setPreviousRunsError(null);
    setSelectedPreviousRunId(null);
    setActiveRunId(null);
    setStreamBootstrap(null);
    setActivityOpen(false);
    loadedWorkflowId.current = null;
    lastPersistedWorkflow.current = null;

    api
      .workflow(id)
      .then(({ workflow, webhookEndpoints: loadedWebhookEndpoints }) => {
        if (cancelled) return;
        const loadedNodes = toFlowNodes(workflow.nodes);
        const loadedEdges = toFlowEdges(workflow.edges);
        setWorkflowName(workflow.title);
        setNodes(loadedNodes);
        setEdges(loadedEdges);
        loadedWorkflowId.current = id;
        lastPersistedWorkflow.current = getWorkflowSnapshotKey(
          loadedNodes,
          loadedEdges,
        );
        setWebhookEndpoints(loadedWebhookEndpoints);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load workflow.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (isLoading || loadError || !id) {
      setPreviousRuns([]);
      setPreviousRunsError(null);
      setPreviousRunsLoading(false);
      return;
    }

    let cancelled = false;
    setPreviousRunsLoading(true);
    setPreviousRunsError(null);

    const loadAllRuns = async () => {
      const allRuns: WorkflowRunSummary[] = [];
      let cursor: string | undefined;
      do {
        const response = await api.workflowRuns({
          workflowId: id,
          limit: 50,
          ...(cursor ? { cursor } : {}),
        });
        allRuns.push(...response.workflowRuns);
        cursor = response.nextCursor;
      } while (cursor);
      return allRuns;
    };

    loadAllRuns()
      .then((runs) => {
        if (cancelled) return;
        setPreviousRuns(runs);
        const latestRun = runs[0];
        if (latestRun) {
          setActiveRunId((current) => current ?? latestRun.id);
        }
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setPreviousRunsError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load previous runs.",
        );
        setPreviousRuns([]);
      })
      .finally(() => {
        if (!cancelled) setPreviousRunsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, isLoading, loadError]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((currentEdges) =>
      addEdge({ ...connection, type: "default" }, currentEdges),
    );
  }, []);

  const handleAddNode = useCallback((type: string) => {
    const definition = getNodeDef(type);

    setNodes((currentNodes) => {
      const index = currentNodes.length;
      return [
        ...currentNodes,
        {
          id: `${type}-${crypto.randomUUID()}`,
          type,
          position: {
            x: 120 + (index % 4) * 240,
            y: 120 + Math.floor(index / 4) * 180,
          },
          data: {
            label: definition?.label ?? type,
            isConfigured: false,
          },
        } satisfies Node,
      ];
    });
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((currentNodes) =>
      currentNodes.filter((node) => node.id !== nodeId),
    );
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId,
      ),
    );
    setConfigTarget((currentTarget) =>
      currentTarget?.nodeId === nodeId ? null : currentTarget,
    );
  }, []);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges((currentEdges) =>
      currentEdges.filter((edge) => edge.id !== edgeId),
    );
  }, []);

  const handleUpdateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...getNodeData(node),
                  ...data,
                },
              }
            : node,
        ),
      );
    },
    [],
  );

  const handleDuplicateNode = useCallback((nodeId: string) => {
    setNodes((currentNodes) => {
      const original = currentNodes.find((node) => node.id === nodeId);
      if (!original) {
        return currentNodes;
      }

      return [
        ...currentNodes,
        {
          ...original,
          id: `${original.type ?? "node"}-${crypto.randomUUID()}`,
          position: {
            x: original.position.x + 40,
            y: original.position.y + 40,
          },
          selected: false,
          data: { ...getNodeData(original) },
        },
      ];
    });
  }, []);

  const getNodeDataById = useCallback(
    (nodeId: string) => {
      const node = nodes.find((currentNode) => currentNode.id === nodeId);
      return node ? getNodeData(node) : {};
    },
    [nodes],
  );

  const validation = useMemo(
    () =>
      validateWorkflow(
        nodes
          .filter((node) => node.type)
          .map((node) => ({
            id: node.id,
            type: node.type as string,
            data: getNodeData(node),
          })),
        edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
        })),
      ),
    [nodes, edges],
  );

  const persistWorkflow = useCallback(
    (nodesToPersist: Node[], edgesToPersist: Edge[]) => {
      const snapshot = getWorkflowSnapshot(nodesToPersist, edgesToPersist);
      const persist = persistQueue.current.then(async () => {
        const { workflow, webhookEndpoints: updatedWebhookEndpoints } =
          await api.updateWorkflow({
            id,
            ...snapshot,
          });

        lastPersistedWorkflow.current = JSON.stringify(snapshot);
        setWebhookEndpoints(updatedWebhookEndpoints);
        setWorkflowName(workflow.title);
        return workflow;
      });

      persistQueue.current = persist.then(
        () => undefined,
        () => undefined,
      );
      return persist;
    },
    [id],
  );

  useEffect(() => {
    if (isLoading || loadedWorkflowId.current !== id) return;

    const snapshotKey = getWorkflowSnapshotKey(nodes, edges);
    if (snapshotKey === lastPersistedWorkflow.current) return;

    const timeout = window.setTimeout(() => {
      if (snapshotKey === lastPersistedWorkflow.current) return;

      void persistWorkflow(nodes, edges).then(
        () => {
          setStatus((currentStatus) =>
            currentStatus?.type === "error" ? null : currentStatus,
          );
        },
        (error: unknown) => {
          setStatus({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to save workflow.",
          });
        },
      );
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [edges, id, isLoading, nodes, persistWorkflow]);

  const handleSave = useCallback(async () => {
    if (saveStatus === "saving") return;

    if (savedResetTimer.current) {
      window.clearTimeout(savedResetTimer.current);
      savedResetTimer.current = null;
    }

    setSaveStatus("saving");
    setStatus(null);
    try {
      await persistWorkflow(nodes, edges);
      setSaveStatus("saved");
      savedResetTimer.current = window.setTimeout(() => {
        setSaveStatus("idle");
        savedResetTimer.current = null;
      }, 1800);
    } catch (error) {
      setSaveStatus("idle");
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to save workflow.",
      });
    }
  }, [edges, nodes, persistWorkflow, saveStatus]);

  const runWorkflow = useCallback(
    async (body: {
      nodeId?: string;
      triggerSource?: "cron" | "webhook";
      triggerNodeId?: string;
    }) => {
      if (isExecuting) return;

      if (validation.issues.some((issue) => issue.type === "error")) {
        setStatus({
          type: "error",
          message:
            validation.issues.find((issue) => issue.type === "error")
              ?.message ?? "Fix validation errors before running.",
        });
        return;
      }

      setIsExecuting(true);
      setStatus(null);
      try {
        await persistWorkflow(nodes, edges);
        const result = await api.executeWorkflow({
          workflowId: id,
          ...body,
        });
        setActiveRunId(result.runId);
        setStreamBootstrap(result.stream ?? null);
        setSelectedPreviousRunId(null);
        setRunHistoryOpen(false);
        setActivityOpen(true);
        setStatus({
          type: "success",
          message: `Run ${result.runId.slice(0, 8)} queued.`,
        });
        void api
          .workflowRuns({ workflowId: id, limit: 20 })
          .then((response: any) => {
            setPreviousRuns(
              (response.workflowRuns ?? []) as WorkflowRunSummary[],
            );
            setPreviousRunsError(null);
          })
          .catch((requestError: unknown) => {
            setPreviousRunsError(
              requestError instanceof Error
                ? requestError.message
                : "Failed to load previous runs.",
            );
          });
      } catch (error) {
        setStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to start execution.",
        });
      } finally {
        setIsExecuting(false);
      }
    },
    [edges, id, isExecuting, nodes, persistWorkflow, validation],
  );

  const handleExecuteWorkflow = useCallback(() => {
    setSelectedPreviousRunId(null);
    setRunHistoryOpen(false);
    void runWorkflow({});
  }, [runWorkflow]);

  const handleExecuteNode = useCallback(
    (nodeId: string) => {
      setSelectedPreviousRunId(null);
      setRunHistoryOpen(false);
      void runWorkflow({ nodeId });
    },
    [runWorkflow],
  );

  const handleExecuteTriggerNow = useCallback(
    (source: "cron" | "webhook", triggerNodeId: string) => {
      setSelectedPreviousRunId(null);
      setRunHistoryOpen(false);
      void runWorkflow({ triggerSource: source, triggerNodeId });
    },
    [runWorkflow],
  );

  const handleOpenNodeConfig = useCallback(
    (nodeId: string, nodeType: string) => {
      setConfigTarget({ nodeId, nodeType });
    },
    [],
  );

  const configNodeData = useMemo(
    () => (configTarget ? getNodeDataById(configTarget.nodeId) : {}),
    [configTarget, getNodeDataById],
  );
  const configWebhookUrl = useMemo(
    () =>
      webhookEndpoints.find(
        (endpoint) => endpoint.nodeId === configTarget?.nodeId,
      )?.url,
    [configTarget?.nodeId, webhookEndpoints],
  );

  if (isLoading) {
    return (
      <div className="flex h-[calc(100svh-4rem)] w-full items-center justify-center bg-[#141414] text-[#87867c]">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading workflow…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-[calc(100svh-4rem)] w-full flex-col items-center justify-center gap-3 bg-[#141414] px-6 text-center">
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {loadError}
        </p>
        <Link
          href="/home"
          className="text-sm text-[#87867c] underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          Back to workflows
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100svh-4rem)] w-full overflow-hidden bg-[#141414]">
      <div className="flex h-full w-full">
        <div
          className={`relative min-w-0 flex-1 transition-[width] duration-200 ${
            activityOpen ? "w-[calc(100%-min(23rem,28vw))]" : "w-full"
          }`}
        >
          <EditorProvider
            onUpdateNodeData={handleUpdateNodeData}
            onDeleteNode={handleDeleteNode}
            onAddNode={handleAddNode}
            onDuplicateNode={handleDuplicateNode}
            getNodeData={getNodeDataById}
            nodeStatuses={{}}
            onExecuteNode={handleExecuteNode}
            onExecuteWorkflow={handleExecuteWorkflow}
            onOpenNodeConfig={handleOpenNodeConfig}
            canEditNodes
          >
            <WorkflowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onExecute={handleExecuteWorkflow}
              onExecuteTriggerNow={handleExecuteTriggerNow}
              isExecuting={isExecuting}
              onOpenDrawer={() => setSidebarOpen(true)}
              onTidyUp={setNodes}
              onEdgeDelete={handleDeleteEdge}
            />

            <NodeConfigDialog
              open={Boolean(configTarget)}
              onOpenChange={(open) => {
                if (!open) setConfigTarget(null);
              }}
              nodeId={configTarget?.nodeId ?? ""}
              nodeType={configTarget?.nodeType ?? ""}
              nodeData={configNodeData}
              webhookUrl={configWebhookUrl}
              onSave={handleUpdateNodeData}
            />
          </EditorProvider>

          <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActivityOpen((open) => !open)}
              aria-expanded={activityOpen}
              aria-controls="workflow-run-events"
              className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                activityOpen
                  ? "border-[#F04D26]/60 bg-[#F04D26]/10 text-white"
                  : "border-[#333333] bg-[#1E1E1E] text-[#e8e6e1] hover:border-[#F04D26]/60 hover:text-white"
              }`}
            >
              <Play className="size-4" />
              Runs
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              title={
                saveStatus === "saving"
                  ? "Saving workflow to cloud…"
                  : saveStatus === "saved"
                    ? "Saved to cloud"
                    : "Save workflow to cloud"
              }
              aria-label={
                saveStatus === "saving"
                  ? "Saving workflow to cloud"
                  : saveStatus === "saved"
                    ? "Workflow saved to cloud"
                    : "Save workflow to cloud"
              }
              className="relative inline-flex h-9 items-center justify-center rounded-lg border border-[#333333] bg-[#1E1E1E] px-3 text-sm font-medium text-[#e8e6e1] transition-colors hover:border-[#F04D26]/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-80"
            >
              {saveStatus === "saving" ? (
                <span
                  className="save-icon save-icon--saving"
                  aria-hidden="true"
                >
                  <CloudUpload className="size-5" />
                  <Loader2
                    className="save-icon__spinner size-2.5 animate-spin"
                    strokeWidth={2.5}
                  />
                </span>
              ) : saveStatus === "saved" ? (
                <span className="save-icon save-icon--saved" aria-hidden="true">
                  <CloudCheck className="size-5" />
                </span>
              ) : (
                <CloudUpload className="size-5" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex size-9 items-center justify-center rounded-full bg-[#F04D26] text-white shadow-lg transition-colors hover:bg-[#E63D00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F04D26]"
              aria-label="Add node"
            >
              <Plus className="size-5" />
            </button>
            {null}
          </div>

          {status && (
            <div
              role="status"
              className={`absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg border px-3 py-2 text-xs shadow-lg ${
                status.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              {status.message}
            </div>
          )}
        </div>

        {activityOpen && (
          <aside
            id="workflow-run-events"
            aria-label="Workflow run events"
            className="flex h-full w-[min(23rem,28vw)] min-w-[min(17rem,20vw)] flex-col border-l border-white/10 bg-[#151515]"
          >
            <div className="flex flex-col border-b border-white/10">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">
                    Execution Logs
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivityOpen(false)}
                  className="flex size-7 items-center justify-center rounded-md text-[#87867c] transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Close run events"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="px-4 pb-2.5">
                {previousRuns.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setRunHistoryOpen((open) => !open)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-white/20 hover:bg-white/[0.04]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs text-white">
                          {selectedPreviousRunId
                            ? `Run ${selectedPreviousRunId.slice(0, 8)}`
                            : activeRunId
                              ? `${activeRunIsLive ? "Current run" : "Latest run"} · ${activeRunId.slice(0, 8)}`
                              : "Select a run"}
                        </p>
                        <p className="text-[11px] text-[#87867c]">
                          {selectedPreviousRunId
                            ? "Viewing historical logs"
                            : activeRunId
                              ? activeRunIsLive
                                ? "Live execution logs"
                                : "Completed run logs"
                              : "Previous runs"}
                        </p>
                      </div>
                      <ChevronDown
                        className={`size-4 text-[#87867c] transition-transform ${
                          runHistoryOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {runHistoryOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a] shadow-2xl">
                        <div className="max-h-72 overflow-y-auto py-1">
                          {activeRunId && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPreviousRunId(null);
                                setRunHistoryOpen(false);
                              }}
                              className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors ${
                                !selectedPreviousRunId
                                  ? "bg-white/[0.06] text-white"
                                  : "text-[#d1d0ca] hover:bg-white/[0.04]"
                              }`}
                            >
                              <span className="truncate text-xs">
                                {activeRunIsLive
                                  ? "Current execution"
                                  : "Latest execution"}
                              </span>
                              <span className="shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-[#b0aea6]">
                                {activeRunIsLive
                                  ? "Live"
                                  : (activeRunStatus ?? "Finished")}
                              </span>
                            </button>
                          )}
                          {previousRunsLoading ? (
                            <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#87867c]">
                              <Loader2 className="size-3 animate-spin" />
                              Loading runs...
                            </div>
                          ) : previousRunsError ? (
                            <p className="px-3 py-2 text-xs text-red-300">
                              {previousRunsError}
                            </p>
                          ) : (
                            previousRuns.map((run) => {
                              const isSelected =
                                selectedPreviousRunId === run.id;
                              const createdAt = run.createdAt
                                ? new Date(run.createdAt).toLocaleString()
                                : null;
                              const statusLabel =
                                typeof run.status === "string"
                                  ? run.status
                                  : "Unknown";
                              return (
                                <button
                                  key={run.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPreviousRunId(run.id);
                                    setRunHistoryOpen(false);
                                    setActivityOpen(true);
                                  }}
                                  className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors ${
                                    isSelected
                                      ? "bg-white/[0.06] text-white"
                                      : "text-[#d1d0ca] hover:bg-white/[0.04]"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-xs">
                                      Run {run.id.slice(0, 8)}
                                    </p>
                                    {createdAt && (
                                      <p className="mt-0.5 truncate text-[11px] text-[#87867c]">
                                        {createdAt}
                                      </p>
                                    )}
                                  </div>
                                  <span className="shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-[#b0aea6]">
                                    {statusLabel}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {selectedPreviousRunId &&
            previousRuns.some((run) => run.id === selectedPreviousRunId) ? (
              <HistoricalRunFeed
                run={previousRuns.find(
                  (run) => run.id === selectedPreviousRunId,
                )!}
              />
            ) : activeRunId ? (
              <ExecutionEventFeed
                events={executionStream.events}
                state={executionStream.state}
                connectionMessage={executionStream.connectionMessage}
                runId={activeRunId}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[#87867c]">
                Run this workflow to see its live events here.
              </div>
            )}
          </aside>
        )}
      </div>

      <AddNodeSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        onAddNode={handleAddNode}
      />
    </div>
  );
}
