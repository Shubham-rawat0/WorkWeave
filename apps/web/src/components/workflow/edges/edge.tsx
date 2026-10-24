"use client";
import React, { memo, useEffect, useRef, useState } from "react";
import {
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";
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
  const [isHovered, setIsHovered] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showDelete = () => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setIsHovered(true);
  };
  const hideDelete = () => {
    hideTimeout.current = setTimeout(() => setIsHovered(false), 100);
  };
  useEffect(
    () => () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    },
    [],
  );
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

        {onDelete ? (
          <path
            d={edgePath}
            fill="none"
            stroke="transparent"
            strokeWidth={16}
            pointerEvents="stroke"
            onMouseEnter={showDelete}
            onMouseLeave={hideDelete}
          />
        ) : null}

        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute flex items-center gap-1"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: edgeLabel || isHovered ? "all" : "none",
            }}
            onMouseEnter={showDelete}
            onMouseLeave={hideDelete}
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
                className={`flex size-6 items-center justify-center bg-transparent text-red-500 transition-[opacity,color,transform] duration-150 hover:scale-110 hover:text-red-400 ${
                  isHovered ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                title="Delete connection"
                aria-label="Delete connection"
              >
                <X className="size-5" strokeWidth={4} />
              </button>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      </g>
    </>
  );
}
export const WorkflowEdge = memo(WorkflowEdgeComponent);
