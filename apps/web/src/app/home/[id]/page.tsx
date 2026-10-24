"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Loader2, Plus, Save } from "lucide-react";
import { api, type WebhookEndpoint } from "@/lib/api";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { EditorProvider } from "@/contexts/EditorContext";
import WorkflowCanvas from "@/components/workflow/canvas";
import { AddNodeSidebar } from "@/components/workflow/addNodeSidebar";
import { NodeConfigDialog } from "@/components/workflow/dialogs";
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

type ActionStatus = { type: "success" | "error"; message: string } | null;

export default function WorkflowPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [webhookEndpoints, setWebhookEndpoints] = useState<WebhookEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState<ActionStatus>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [configTarget, setConfigTarget] = useState<{
    nodeId: string;
    nodeType: string;
  } | null>(null);

  usePageTitle(
    loadError ? "Workflow unavailable" : (workflowName ?? "Loading…"),
  );

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setLoadError(null);
    setStatus(null);
    setConfigTarget(null);

    api
      .workflow(id)
      .then(({ workflow, webhookEndpoints: loadedWebhookEndpoints }) => {
        if (cancelled) return;
        setWorkflowName(workflow.title);
        setNodes(toFlowNodes(workflow.nodes));
        setEdges(toFlowEdges(workflow.edges));
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

  const persistWorkflow = useCallback(async () => {
    const { workflow, webhookEndpoints: updatedWebhookEndpoints } =
      await api.updateWorkflow({
        id,
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
      });

    setWebhookEndpoints(updatedWebhookEndpoints);
    setWorkflowName(workflow.title);
    return workflow;
  }, [id, nodes, edges]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    const saveStartedAt = Date.now();
    setIsSaving(true);
    setStatus(null);
    try {
      await persistWorkflow();
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to save workflow.",
      });
    } finally {
      const remainingAnimationTime = Math.max(
        0,
        2000 - (Date.now() - saveStartedAt),
      );
      if (remainingAnimationTime > 0) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, remainingAnimationTime),
        );
      }
      setIsSaving(false);
    }
  }, [isSaving, persistWorkflow]);

  const runWorkflow = useCallback(
    async (
      body: { nodeId?: string; triggerSource?: "cron" | "webhook"; triggerNodeId?: string },
    ) => {
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
        await persistWorkflow();
        const result = await api.executeWorkflow({
          workflowId: id,
          ...body,
        });
        setStatus({
          type: "success",
          message: `Run ${result.runId.slice(0, 8)} queued.`,
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
    [id, isExecuting, persistWorkflow, validation],
  );

  const handleExecuteWorkflow = useCallback(() => {
    void runWorkflow({});
  }, [runWorkflow]);

  const handleExecuteNode = useCallback(
    (nodeId: string) => {
      void runWorkflow({ nodeId });
    },
    [runWorkflow],
  );

  const handleExecuteTriggerNow = useCallback(
    (source: "cron" | "webhook", triggerNodeId: string) => {
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
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-lg border border-[#333333] bg-[#1E1E1E] px-3 text-sm font-medium text-[#e8e6e1] transition-colors hover:border-[#F04D26]/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-80"
        >
          {isSaving ? (
            <>
              <Save className="size-4 opacity-40" />
              <div className="save-feedback save-feedback--btn">
                <span className="save-feedback__bar" />
                <span className="save-feedback__bar" />
                <span className="save-feedback__bar" />
              </div>
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save
            </>
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

      <AddNodeSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        onAddNode={handleAddNode}
      />
    </div>
  );
}
