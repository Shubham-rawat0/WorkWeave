import { nodeTypes } from "@/lib/reactflow/nodeTypes";
import {Node, Edge, OnNodesChange, OnEdgesChange, Connection } from "@xyflow/react";
import { useCallback, useMemo, useState } from "react";

interface WorkflowCanvasProps {
    nodes:Node[],
    edges:Edge[],
    onNodesChange:OnNodesChange,
    onEdgesChange:OnEdgesChange,
    onConnect:(connection:Connection)=>void,
    onExecute?:()=>void,
    onExecuteTriggerNow?: (
        source: "cron" | "webhook",
        triggerNodeId: string,
    ) => void;
    isExecuting?: boolean;
    isCronTriggerRunning?: boolean;
    onOpenDrawer?: () => void;
    onTidyUp?: (layoutedNodes: Node[]) => void;
}

const WorkflowCanvas:React.FC<WorkflowCanvasProps>=({ 
    nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onExecute,
  onExecuteTriggerNow,
  isExecuting,
  isCronTriggerRunning = false,
  onOpenDrawer,
  onTidyUp,})=>{
    const memoizedNodeTypes = useMemo(() => nodeTypes, []);
    const [isInteractive, setIsInteractive] = useState(true);
    const hasNodes = nodes.length > 0;
    const hasSelectedNodes = nodes.some((n) => n.selected);

    const hasActiveManualTrigger = useMemo(
    () =>
      nodes.some((node) => {
        if (node.type !== "manualTrigger" && node.type !== "triggerNode") {
          return false;
        }
        const nodeData =
          node.data && typeof node.data === "object"
            ? (node.data as Record<string, unknown>)
            : null;
        return nodeData?.isActive !== false;
      }),
    [nodes],
  );

  const runNowCandidate = useMemo<{
    source: "cron" | "webhook";
    nodeId: string;
  } | null>(() => {
    if (hasActiveManualTrigger) {
      return null;
    }
    const isRunnableTriggerNode = (node: Node): boolean => {
      const nodeData =
        node.data && typeof node.data === "object"
          ? (node.data as Record<string, unknown>)
          : null;
      return nodeData?.isActive !== false && nodeData?.isConfigured === true;
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

  const canRunNowViaTrigger = Boolean(runNowCandidate && onExecuteTriggerNow);
  const disableManualExecute = !hasActiveManualTrigger && canRunNowViaTrigger;
  const isCronRunButton = runNowCandidate?.source === "cron";
  const isCronRunButtonActive = isCronRunButton && isCronTriggerRunning;

const handleRunNowViaTrigger = useCallback(() => {
    if (!runNowCandidate || !onExecuteTriggerNow) {
      return;
    }
    if (runNowCandidate.source === "cron") {
      return;
    }
    onExecuteTriggerNow(runNowCandidate.source, runNowCandidate.nodeId);
  }, [runNowCandidate, onExecuteTriggerNow]);

  const validation = useMemo(() => {
    return validateWorkflow(
      nodes
        .filter((n) => n.type)
        .map((n) => ({ id: n.id, type: n.type!, data: n.data })),
      edges.map((e) => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
      })),
    );
  }, [nodes, edges]);

  
}