"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Plug, SlidersHorizontal, Trash2, Unplug } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import { useEditor } from "@/contexts/EditorContext";
import { NodeConfigDialog } from "../dialogs";
const NODE_ENTRANCE = {
  spring: { type: "spring" as const, stiffness: 350, damping: 25 },
};
interface BaseNodeProps {
  id: string;
  selected?: boolean;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  isConfigured?: boolean;
  isTrigger?: boolean;
  nodeType: string;
  hideDefaultSourceHandle?: boolean;
  sourceHandles?: Array<{
    id: string;
    label?: string;
    top?: string;
  }>;
}
export default function BaseNode({
  id,
  selected,
  icon,
  label,
  subtitle,
  isConfigured,
  isTrigger,
  nodeType,
  hideDefaultSourceHandle,
  sourceHandles,
}: BaseNodeProps) {
  const {
    deleteNode,
    getNodeData,
    updateNodeData,
    nodeStatuses,
    executeNode,
    executeWorkflow,
    openNodeConfig,
    canEditNodes,
  } = useEditor();
  const [configOpen, setConfigOpen] = useState(false);
  const executionStatus = nodeStatuses[id];
  const nodeData = (getNodeData(id) || {}) as Record<string, unknown>;
  const isNodeActive = nodeData.isActive !== false;
  const isManualTriggerNode =
    isTrigger && (nodeType === "triggerNode" || nodeType === "manualTrigger");

  const handleExecute = () => {
    if (!isNodeActive) return;
    if (isManualTriggerNode) {
      executeWorkflow?.();
      return;
    }
    executeNode?.(id);
  };

  const handleToggleActive = () => {
    void Promise.resolve(updateNodeData(id, { isActive: !isNodeActive }));
  };

  const handleConfigure = () => {
    if (openNodeConfig) {
      openNodeConfig(id, nodeType);
      return;
    }
    setConfigOpen(true);
  };
  return (
    <motion.div
      className="relative group flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={NODE_ENTRANCE.spring}
    >
      <div className="relative">
        {canEditNodes && (
          <div className="absolute -top-10 left-1/2 z-10 flex -translate-x-1/2 gap-1 opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:opacity-100 nodrag">
            <button
              type="button"
              onClick={handleExecute}
              disabled={!isNodeActive}
              className="flex size-8 items-center justify-center rounded border border-[#5b5b5b] bg-[#2D2D2E] text-white transition-[color,background-color,transform] duration-100 ease-out hover:bg-[#3e3e3e] active:scale-[0.95] disabled:cursor-not-allowed disabled:bg-[#2D2D2E] disabled:text-white/50"
              title={
                isManualTriggerNode ? "Execute workflow" : "Execute step"
              }
              aria-label={
                isManualTriggerNode ? "Execute workflow" : "Execute step"
              }
            >
              <Play className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleToggleActive}
              className={`flex size-8 items-center justify-center rounded border transition-[color,background-color,transform] duration-100 ease-out active:scale-[0.95] ${
                isNodeActive
                  ? "border-[#5b5b5b] bg-[#2D2D2E] text-white hover:bg-[#3e3e3e]"
                  : "border-[#6f4f4f] bg-[#3A2A2A] text-[#ffb6b6] hover:bg-[#4a3030]"
              }`}
              title={isNodeActive ? "Deactivate node" : "Activate node"}
              aria-label={isNodeActive ? "Deactivate node" : "Activate node"}
            >
              {isNodeActive ? (
                <Unplug className="size-4" />
              ) : (
                <Plug className="size-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => deleteNode(id)}
              className="flex size-8 items-center justify-center rounded border border-[#5b5b5b] bg-[#2D2D2E] text-white transition-[color,background-color,transform] duration-100 ease-out hover:bg-[#3e3e3e] active:scale-[0.95]"
              title="Delete node"
              aria-label="Delete node"
            >
              <Trash2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleConfigure}
              className="flex size-8 items-center justify-center rounded border border-[#5b5b5b] bg-[#2D2D2E] text-white transition-[color,background-color,transform] duration-100 ease-out hover:bg-[#3e3e3e] active:scale-[0.95]"
              title="Configure node"
              aria-label="Configure node"
            >
              <SlidersHorizontal className="size-4" />
            </button>
          </div>
        )}
        <div
          className={`
            relative w-[120px] h-[120px] rounded-2xl bg-[#2D2D2E]
            border-2 transition-[border-color,box-shadow] duration-300 ease-out
            ${
              executionStatus === "Running"
                ? "border-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.3)]"
                : executionStatus === "Success"
                  ? "border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                  : executionStatus === "Skipped"
                    ? "border-[#6b7280] shadow-[0_0_10px_rgba(107,114,128,0.2)]"
                    : executionStatus === "Failed"
                      ? "border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                      : !isNodeActive
                        ? "border-[#4a4a4a] shadow-none"
                        : selected
                          ? "border-[#999] shadow-lg"
                          : "border-[#5b5b5b]"
            }
            ${selected ? "ring-2 ring-white/25 ring-offset-2 ring-offset-[#141414]" : ""}
            ${!isNodeActive ? "opacity-60" : ""}
            hover:shadow-[0_1px_4px_1px_rgba(255,255,255,0.08)]
          `}
        >
          {!isNodeActive && (
            <div className="absolute top-2 right-2 z-10 rounded bg-[#2D2D2E] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/65 border border-[#5b5b5b]">
              Off
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center">
            {icon}
          </div>

          {executionStatus && (
            <div className="absolute bottom-2 right-2 z-10">
              {(executionStatus === "Running" ||
                executionStatus === "Pending") && (
                <div className="relative w-4 h-4 rounded-full bg-[#2D2D2E] border border-yellow-500 flex items-center justify-center overflow-hidden">
                  <svg
                    className="absolute inset-0 size-4 text-yellow-400 animate-[spin_1.6s_linear_infinite]"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6.25"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeDasharray="12 28"
                    />
                  </svg>
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-yellow-400"
                    style={{
                      animation: "status-pulse 2.2s ease-in-out infinite",
                    }}
                  />
                </div>
              )}
              {executionStatus === "Success" && (
                <div className="w-4 h-4 rounded-full bg-[#2D2D2E] border border-green-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
              )}
              {executionStatus === "Skipped" && (
                <div className="w-4 h-4 rounded-full bg-[#2D2D2E] border border-[#6b7280] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#9ca3af]" />
                </div>
              )}
              {(executionStatus === "Failed" ||
                executionStatus === "Failure") && (
                <div className="w-4 h-4 rounded-full bg-[#2D2D2E] border border-red-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                </div>
              )}
            </div>
          )}

          {!isConfigured && !executionStatus && isNodeActive && (
            <div className="absolute bottom-2 right-2 z-10 animate-pulse">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-full blur-sm"></div>
                <svg
                  width="18px"
                  height="18px"
                  className="text-red-500 relative z-10 drop-shadow-lg"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    fillRule="evenodd"
                    d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM11 9a1 1 0 0 1 2 0v4a1 1 0 1 1-2 0V9zm1 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          )}

          {!isTrigger && (
            <Handle
              type="target"
              position={Position.Left}
              className="w-4! h-4! bg-[#5b5b5b]! border-2! border-[#2D2D2E]! rounded-full transition-[background-color,transform] duration-150 ease-out hover:bg-[#999]! hover:scale-110!"
            />
          )}

          {!hideDefaultSourceHandle && (
            <Handle
              type="source"
              position={Position.Right}
              className="w-4! h-4! bg-[#5b5b5b]! border-2! border-[#2D2D2E]! rounded-full transition-[background-color,transform] duration-150 ease-out hover:bg-[#999]! hover:scale-110!"
            />
          )}

          {sourceHandles?.map((handle) => (
            <div key={handle.id}>
              <Handle
                id={handle.id}
                type="source"
                position={Position.Right}
                style={{ top: handle.top ?? "50%" }}
                className="w-4! h-4! bg-[#6f6f6f]! border-2! border-[#2D2D2E]! rounded-full transition-[background-color,transform] duration-150 ease-out hover:bg-[#ddd]! hover:scale-110!"
              />
              {handle.label && (
                <span
                  className="absolute text-[10px] text-white/50 uppercase tracking-wide"
                  style={{
                    top: handle.top ?? "50%",
                    right: "-56px",
                    transform: "translateY(-50%)",
                  }}
                >
                  {handle.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center text-center pointer-events-none">
        <p className="text-white font-medium text-sm whitespace-nowrap">
          {label}
        </p>
        {subtitle && (
          <p className="text-[#999] text-xs whitespace-nowrap">{subtitle}</p>
        )}
      </div>

      {!openNodeConfig && (
        <NodeConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          nodeId={id}
          nodeType={nodeType}
          nodeData={getNodeData(id) || {}}
          onSave={(nodeId, data) => updateNodeData(nodeId, data)}
        />
      )}
    </motion.div>
  );
}