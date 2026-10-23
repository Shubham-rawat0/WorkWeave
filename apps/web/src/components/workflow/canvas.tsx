"use client";

import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type OnEdgesChange,
  type OnNodesChange,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Focus,
  Loader2,
  Play,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { validateWorkflow } from "@WorkOrchestrator/shared/core";
import { nodeTypes } from "@/lib/reactflow/nodeTypes";
import { edgeTypes } from "@/lib/reactflow/edgeTypes";
import { EdgeDeleteContext } from "@/components/workflow/edges/edgeActionsContext";

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onExecute?: () => void | Promise<void>;
  onExecuteTriggerNow?: (
    source: "cron" | "webhook",
    triggerNodeId: string,
  ) => void | Promise<void>;
  isExecuting?: boolean;
  isCronTriggerRunning?: boolean;
  onOpenDrawer?: () => void;
  onTidyUp?: (layoutedNodes: Node[]) => void;
  onEdgeDelete?: (edgeId: string) => void;
}

type RunCandidate = {
  source: "cron" | "webhook";
  nodeId: string;
};

function getNodeData(node: Node): Record<string, unknown> {
  return node.data && typeof node.data === "object"
    ? (node.data as Record<string, unknown>)
    : {};
}

function isActive(node: Node): boolean {
  return getNodeData(node).isActive !== false;
}

function computeTidyLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const incoming = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const node of nodes) {
    incoming.set(node.id, 0);
    children.set(node.id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    children.get(edge.source)?.push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  const levels = new Map<string, number>();
  const queue = nodes
    .filter((node) => (incoming.get(node.id) ?? 0) === 0)
    .sort(
      (a, b) =>
        a.position.y - b.position.y || a.position.x - b.position.x,
    )
    .map((node) => node.id);

  for (const id of queue) {
    levels.set(id, 0);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const currentLevel = levels.get(current) ?? 0;

    for (const child of children.get(current) ?? []) {
      const nextLevel = currentLevel + 1;
      if (nextLevel > (levels.get(child) ?? -1)) {
        levels.set(child, nextLevel);
      }
      if (!queue.includes(child)) {
        queue.push(child);
      }
    }
  }

  let fallbackLevel = Math.max(0, ...levels.values()) + 1;
  for (const node of nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, fallbackLevel);
      fallbackLevel += 1;
    }
  }

  const columns = new Map<number, Node[]>();
  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    const column = columns.get(level) ?? [];
    column.push(node);
    columns.set(level, column);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [level, column] of columns) {
    column.sort(
      (a, b) =>
        a.position.y - b.position.y || a.position.x - b.position.x,
    );
    column.forEach((node, index) => {
      positions.set(node.id, {
        x: 80 + level * 260,
        y: 80 + index * 170,
      });
    });
  }

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
}

function WorkflowCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onExecute,
  onExecuteTriggerNow,
  isExecuting = false,
  isCronTriggerRunning = false,
  onOpenDrawer,
  onTidyUp,
  onEdgeDelete,
}: WorkflowCanvasProps) {
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const hasNodes = nodes.length > 0;
  const [isPending, startTransition] = useTransition();

  const hasActiveManualTrigger = useMemo(
    () =>
      nodes.some((node) => {
        if (node.type !== "manualTrigger" && node.type !== "triggerNode") {
          return false;
        }
        return isActive(node);
      }),
    [nodes],
  );

  const runNowCandidate = useMemo<RunCandidate | null>(() => {
    if (hasActiveManualTrigger) {
      return null;
    }

    const isRunnableTriggerNode = (node: Node): boolean => {
      const nodeData = getNodeData(node);
      return nodeData.isActive !== false && nodeData.isConfigured === true;
    };

    const activeCron = nodes.find(
      (node) => node.type === "cronTrigger" && isRunnableTriggerNode(node),
    );
    if (activeCron) {
      return { source: "cron", nodeId: activeCron.id };
    }

    const activeWebhook = nodes.find(
      (node) => node.type === "webhookTrigger" && isRunnableTriggerNode(node),
    );
    if (activeWebhook) {
      return { source: "webhook", nodeId: activeWebhook.id };
    }

    return null;
  }, [nodes, hasActiveManualTrigger]);

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

  const hasValidationErrors = validation.issues.some(
    (issue) => issue.type === "error",
  );
  const hasValidationWarnings = validation.issues.some(
    (issue) => issue.type === "warning",
  );
  const isCronRunButton = runNowCandidate?.source === "cron";
  const isCronRunButtonActive = isCronRunButton && isCronTriggerRunning;
  const isExecuteDisabled =
    isPending ||
    isExecuting ||
    hasValidationErrors ||
    isCronRunButtonActive ||
    (!hasActiveManualTrigger && !runNowCandidate);

  const {
    fitView,
    zoomIn,
    zoomOut,
    setNodes: setFlowNodes,
    getNodes,
  } = useReactFlow();

  const handleSelectAll = useCallback(() => {
    setFlowNodes(getNodes().map((node) => ({ ...node, selected: true })));
  }, [setFlowNodes, getNodes]);

  const handleClearSelection = useCallback(() => {
    setFlowNodes(getNodes().map((node) => ({ ...node, selected: false })));
  }, [setFlowNodes, getNodes]);

  const handleTidyUp = useCallback(() => {
    const layouted = computeTidyLayout(nodes, edges);
    if (onTidyUp) {
      onTidyUp(layouted);
    } else {
      setFlowNodes(layouted);
    }
    setTimeout(() => {
      void fitView({ duration: 400, padding: 0.2 });
    }, 50);
  }, [nodes, edges, onTidyUp, setFlowNodes, fitView]);

  const handleZoomIn = useCallback(() => {
    void zoomIn({ duration: 200 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    void zoomOut({ duration: 200 });
  }, [zoomOut]);

  const handleFocus = useCallback(() => {
    void fitView({ duration: 400, padding: 0.2 });
  }, [fitView]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.key === "Escape") {
        handleClearSelection();
        return;
      }

      if (
        event.key === "Tab" &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        onOpenDrawer?.();
      } else if (event.key === "T" && event.shiftKey && event.altKey) {
        event.preventDefault();
        handleTidyUp();
      } else if ((event.metaKey || event.ctrlKey) && event.key === "a") {
        event.preventDefault();
        handleSelectAll();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenDrawer, handleTidyUp, handleSelectAll, handleClearSelection]);

  const handleExecute = useCallback(() => {
    if (isExecuteDisabled) {
      return;
    }
    startTransition(() => {
      if (runNowCandidate && onExecuteTriggerNow) {
        void onExecuteTriggerNow(runNowCandidate.source, runNowCandidate.nodeId);
        return;
      }
      void onExecute?.();
    });
  }, [
    isExecuteDisabled,
    runNowCandidate,
    onExecuteTriggerNow,
    onExecute,
  ]);

  const executeLabel = isExecuting || isPending
    ? "Running..."
    : hasActiveManualTrigger
      ? "Execute workflow"
      : runNowCandidate
        ? `Run ${runNowCandidate.source}`
        : "No active trigger";

  return (
    <div className="h-full w-full">
      <EdgeDeleteContext.Provider value={onEdgeDelete ?? null}>
        <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={memoizedNodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 0.75 }}
        className="h-full w-full"
        minZoom={0.2}
        maxZoom={2}
        panOnScroll={hasNodes}
        panOnScrollSpeed={0.5}
        panOnDrag={hasNodes}
        zoomOnScroll={hasNodes}
        zoomOnPinch={hasNodes}
        zoomOnDoubleClick={hasNodes}
        nodesDraggable={hasNodes}
        nodesConnectable={hasNodes}
        elementsSelectable={hasNodes}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "default" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#303030"
        />

        <Panel position="bottom-center" className="mb-6">
          <button
            type="button"
            onClick={handleExecute}
            disabled={isExecuteDisabled}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F04D26] px-4 text-sm font-medium text-white shadow-lg transition-colors hover:bg-[#E63D00] disabled:cursor-not-allowed disabled:bg-[#2D2D2E] disabled:text-white/40"
          >
            {isExecuting || isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {executeLabel}
          </button>
        </Panel>

        <Panel position="bottom-left" className="m-4 max-w-sm space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-md border border-[#333333] bg-[#1E1E1E] shadow-lg">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={!hasNodes}
                title="Zoom out"
                aria-label="Zoom out"
                className="flex size-8 items-center justify-center text-[#c9c9c5] transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ZoomOut className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleFocus}
                disabled={!hasNodes}
                title="Focus workflow"
                aria-label="Focus workflow"
                className="flex size-8 items-center justify-center border-x border-[#333333] text-[#c9c9c5] transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Focus className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={!hasNodes}
                title="Zoom in"
                aria-label="Zoom in"
                className="flex size-8 items-center justify-center text-[#c9c9c5] transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ZoomIn className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleTidyUp}
              disabled={!hasNodes}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#333333] bg-[#1E1E1E] px-2.5 text-xs font-medium text-[#c9c9c5] transition-colors hover:border-[#F04D26]/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="size-3.5" />
              Tidy up
            </button>
          </div>

          {hasValidationErrors ? (
            <div className="rounded-lg border border-red-500/30 bg-[#1a1414]/95 px-3 py-2 text-xs text-red-300 shadow-lg backdrop-blur">
              <p className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="size-3.5" />
                {validation.issues.filter((issue) => issue.type === "error")
                  .length}{" "}
                validation error(s)
              </p>
              <ul className="mt-1 space-y-0.5">
                {validation.issues
                  .filter((issue) => issue.type === "error")
                  .slice(0, 3)
                  .map((issue, index) => (
                    <li key={`${issue.message}-${index}`}>{issue.message}</li>
                  ))}
              </ul>
            </div>
          ) : hasNodes ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-[#121a14]/95 px-3 py-1.5 text-xs text-emerald-300 shadow-lg backdrop-blur">
              <CheckCircle2 className="size-3.5" />
              {hasValidationWarnings ? "Ready with warnings" : "Workflow valid"}
            </div>
          ) : null}
        </Panel>
        </ReactFlow>
      </EdgeDeleteContext.Provider>
    </div>
  );
}

export default function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}