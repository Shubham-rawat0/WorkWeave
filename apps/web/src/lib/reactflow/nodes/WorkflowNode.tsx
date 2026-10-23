"use client";

import { Handle, Position } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useEditor } from "@/contexts/EditorContext";

export type NodeStatus = "Running" | "Success" | "Skipped";

const STATUS_RING: Record<NodeStatus, string> = {
  Running:
    "border-[#c4a96b] shadow-[0_0_0_1px_rgba(196,169,107,0.35),0_0_20px_rgba(196,169,107,0.18)]",
  Success: "border-[#4f8f4f] shadow-[0_0_0_1px_rgba(79,143,79,0.3)]",
  Skipped: "border-[#333333] opacity-60",
};

export interface WorkflowSourceHandle {
  id: string;
  style?: CSSProperties;
}

interface WorkflowNodeProps {
  id: string;
  icon: ReactNode;
  label: string;
  sourceHandles?: WorkflowSourceHandle[];
}

export function WorkflowNode({
  id,
  icon,
  label,
  sourceHandles = [{ id: "source" }],
}: WorkflowNodeProps) {
  const ctx = useEditor();
  const status = ctx.nodeStatuses[id] as NodeStatus | undefined;
  const ring =
    (status && STATUS_RING[status]) ?? "border-[#333333]";

  return (
    <div
      className={
        "group relative flex w-[92px] flex-col items-center gap-1.5 rounded-xl border bg-[#1E1E1E] px-2 py-3 transition-colors duration-150 " +
        ring
      }
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-1.5 !border !border-[#3a3a38] !bg-[#6a6a67]"
      />

      {sourceHandles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={Position.Right}
          style={handle.style}
          className="!size-1.5 !border !border-[#3a3a38] !bg-[#6a6a67]"
        />
      ))}

      {ctx.canEditNodes && (
        <button
          type="button"
          onClick={() => ctx.deleteNode(id)}
          aria-label={`Delete ${label}`}
          title="Delete node"
          className="absolute -right-1.5 -top-1.5 z-10 flex size-4 items-center justify-center rounded-md border border-[#3a3a38] bg-[#262626] text-[#8a8a87] opacity-0 transition-all duration-150 group-hover:opacity-100 hover:border-[#7a3a3a] hover:bg-[#3a2020] hover:text-[#e08a8a] focus-visible:opacity-100"
        >
          <Trash2 className="size-2.5" />
        </button>
      )}

      <div className="flex h-7 w-7 items-center justify-center text-[#d6d6d2]">
        {icon}
      </div>
      <span className="max-w-full text-center text-[10px] font-medium leading-tight text-[#d6d6d2]">
        {label}
      </span>
    </div>
  );
}