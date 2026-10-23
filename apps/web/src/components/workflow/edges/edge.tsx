"use client";
import React, { memo } from "react";
import {
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { useEdgeDelete } from "./edgeActionsContext";

function WorkflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps) {
  const onDelete = useEdgeDelete();
  const edgeLabel =
    typeof (
      data as
        | {
            route?: unknown;
          }
        | undefined
    )?.route === "string"
      ? (
          data as {
            route: string;
          }
        ).route
      : "";
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  return (
    <>
      <g style={{ zIndex: 1 }}>
        <EdgeLabelRenderer>
          <style>{`
            @keyframes workflow-edge-dash-${id} {
              from {
                stroke-dashoffset: 0;
              }
              to {
                stroke-dashoffset: -12;
              }
            }
          `}</style>
        </EdgeLabelRenderer>

        <path
          id={id}
          d={edgePath}
          fill="none"
          className="react-flow__edge-path"
          style={{
            stroke: selected ? "#F04D26" : "#555555",
            strokeWidth: selected ? 2.5 : 2,
            strokeDasharray: "6, 6",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            pointerEvents: "none",
            animation: `workflow-edge-dash-${id} 1s linear infinite`,
            willChange: "stroke-dashoffset",
          }}
        />

        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute flex items-center gap-1"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            {edgeLabel ? (
              <span className="rounded-md border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                {edgeLabel}
              </span>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(id);
                }}
                className="flex size-6 items-center justify-center rounded-md border border-[#5b5b5b] bg-[#1E1E1E] text-[#999] shadow-sm transition-colors hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-400"
                title="Delete connection"
                aria-label="Delete connection"
              >
                <Trash2 className="size-3" />
              </button>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      </g>
    </>
  );
}
export const WorkflowEdge = memo(WorkflowEdgeComponent);
