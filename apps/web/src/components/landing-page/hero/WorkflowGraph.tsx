"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Webhook,
  ShieldCheck,
  GitBranch,
  Database,
  Globe,
  GitMerge,
  CheckCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens (matching the project palette)
// ---------------------------------------------------------------------------
const C = {
  bg: "#1a1a1a",
  nodeBg: "#222222",
  nodeBorder: "#333333",
  nodeActiveBorder: "#6b7c6b",  // sage-green tint
  nodeActiveGlow: "rgba(107,124,107,0.18)",
  nodeCompleteBorder: "#7c8c7c",
  nodeDoneGlow: "rgba(100,140,100,0.22)",
  label: "#c9c9c5",             // off-white
  sublabel: "#6b6b68",          // muted warm-gray
  connector: "#3a3a38",
  dot: "#c4a96b",               // warm amber
  dotComplete: "#7cb87c",       // sage green
  iconIdle: "#5a5a57",
  iconActive: "#b0b89e",        // sage
  iconComplete: "#7cb87c",
} as const;

// ---------------------------------------------------------------------------
// Layout constants – all positions are in a 560 × 380 viewBox
// ---------------------------------------------------------------------------
const VW = 560;
const VH = 420;

// Node dimensions
const NW = 138; // node width
const NH = 46;  // node height
const NR = 8;   // corner radius

// Vertical lanes
const ROW1 = 50;    // trigger
const ROW2 = 140;   // validate
const ROW3 = 230;   // condition
const ROW4 = 320;   // parallel branches
const ROW5 = 320;
const ROW_MERGE = 320;
const ROW_DONE = 410 - NH;  // near bottom

// Horizontal centres
const CX_MAIN = VW / 2;       // 280 – main column
const CX_LEFT = 145;          // left branch
const CX_RIGHT = 415;         // right branch

// Derived top-left corners
function nodeX(cx: number) { return cx - NW / 2; }
function nodeY(cy: number) { return cy - NH / 2; }

// ---------------------------------------------------------------------------
// Node definitions
// ---------------------------------------------------------------------------
type NodeId =
  | "trigger"
  | "validate"
  | "condition"
  | "taskA"
  | "taskB"
  | "merge"
  | "done";

interface NodeDef {
  id: NodeId;
  label: string;
  sublabel: string;
  cx: number;
  cy: number;
  Icon: React.ElementType;
}

const NODES: NodeDef[] = [
  {
    id: "trigger",
    label: "Webhook",
    sublabel: "POST /trigger",
    cx: CX_MAIN,
    cy: ROW1,
    Icon: Webhook,
  },
  {
    id: "validate",
    label: "Validate Request",
    sublabel: "Schema · Auth",
    cx: CX_MAIN,
    cy: ROW2,
    Icon: ShieldCheck,
  },
  {
    id: "condition",
    label: "Condition",
    sublabel: "Route by type",
    cx: CX_MAIN,
    cy: ROW3,
    Icon: GitBranch,
  },
  {
    id: "taskA",
    label: "Sync Database",
    sublabel: "Write records",
    cx: CX_LEFT,
    cy: ROW4,
    Icon: Database,
  },
  {
    id: "taskB",
    label: "Notify API",
    sublabel: "Send webhook",
    cx: CX_RIGHT,
    cy: ROW5,
    Icon: Globe,
  },
  {
    id: "merge",
    label: "Merge Results",
    sublabel: "Collect outputs",
    cx: CX_MAIN,
    cy: ROW_MERGE,
    Icon: GitMerge,
  },
  {
    id: "done",
    label: "Completed",
    sublabel: "Run finished",
    cx: CX_MAIN,
    cy: ROW_DONE,
    Icon: CheckCircle,
  },
];

// ---------------------------------------------------------------------------
// Connector path helpers
// ---------------------------------------------------------------------------
// Simple vertical drop with gentle curve
function vPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
}

// For branch connectors we need a stronger curve
function branchPath(
  fromCx: number,
  fromBottomY: number,
  toCx: number,
  toTopY: number,
): string {
  const cp1y = fromBottomY + 32;
  const cp2y = toTopY - 32;
  return `M ${fromCx} ${fromBottomY} C ${fromCx} ${cp1y}, ${toCx} ${cp2y}, ${toCx} ${toTopY}`;
}

interface ConnectorDef {
  id: string;
  d: string;
  from: NodeId;
  to: NodeId;
}

const CONNECTORS: ConnectorDef[] = [
  {
    id: "trigger-validate",
    from: "trigger",
    to: "validate",
    d: vPath(CX_MAIN, ROW1 + NH / 2, CX_MAIN, ROW2 - NH / 2),
  },
  {
    id: "validate-condition",
    from: "validate",
    to: "condition",
    d: vPath(CX_MAIN, ROW2 + NH / 2, CX_MAIN, ROW3 - NH / 2),
  },
  {
    id: "condition-taskA",
    from: "condition",
    to: "taskA",
    d: branchPath(CX_MAIN, ROW3 + NH / 2, CX_LEFT, ROW4 - NH / 2),
  },
  {
    id: "condition-taskB",
    from: "condition",
    to: "taskB",
    d: branchPath(CX_MAIN, ROW3 + NH / 2, CX_RIGHT, ROW5 - NH / 2),
  },
  {
    id: "taskA-merge",
    from: "taskA",
    to: "merge",
    d: branchPath(CX_LEFT, ROW4 + NH / 2, CX_MAIN, ROW_MERGE - NH / 2),
  },
  {
    id: "taskB-merge",
    from: "taskB",
    to: "merge",
    d: branchPath(CX_RIGHT, ROW5 + NH / 2, CX_MAIN, ROW_MERGE - NH / 2),
  },
  {
    id: "merge-done",
    from: "merge",
    to: "done",
    d: vPath(CX_MAIN, ROW_MERGE + NH / 2, CX_MAIN, ROW_DONE - NH / 2),
  },
];

// ---------------------------------------------------------------------------
// Animation state machine
// ---------------------------------------------------------------------------
// Each "step" defines which nodes are active/complete and which connector
// has a moving dot (and where along it: 0→1).
type NodeState = "idle" | "active" | "complete";

interface AnimStep {
  /** nodes that should appear active during this step */
  activeNodes: NodeId[];
  /** nodes that are already completed */
  completeNodes: NodeId[];
  /** which connector the dot travels along (null = no dot visible) */
  connector: string | null;
  /** duration of this step in ms */
  duration: number;
}

const STEPS: AnimStep[] = [
  // 0 – idle / reset
  { activeNodes: [], completeNodes: [], connector: null, duration: 900 },
  // 1 – trigger activates
  { activeNodes: ["trigger"], completeNodes: [], connector: null, duration: 600 },
  // 2 – dot travels trigger → validate
  { activeNodes: ["trigger"], completeNodes: [], connector: "trigger-validate", duration: 700 },
  // 3 – validate activates, trigger done
  { activeNodes: ["validate"], completeNodes: ["trigger"], connector: null, duration: 500 },
  // 4 – dot travels validate → condition
  { activeNodes: ["validate"], completeNodes: ["trigger"], connector: "validate-condition", duration: 700 },
  // 5 – condition activates, validate done
  { activeNodes: ["condition"], completeNodes: ["trigger", "validate"], connector: null, duration: 500 },
  // 6 – dots branch to taskA and taskB simultaneously
  { activeNodes: ["condition"], completeNodes: ["trigger", "validate"], connector: "condition-taskA", duration: 700 },
  // 7 – taskA + taskB active, condition done
  { activeNodes: ["taskA", "taskB"], completeNodes: ["trigger", "validate", "condition"], connector: null, duration: 700 },
  // 8 – taskA done, dot to merge (from A)
  { activeNodes: ["taskA", "taskB"], completeNodes: ["trigger", "validate", "condition"], connector: "taskA-merge", duration: 700 },
  // 9 – taskB done, dot to merge (from B)
  { activeNodes: ["taskB"], completeNodes: ["trigger", "validate", "condition", "taskA"], connector: "taskB-merge", duration: 700 },
  // 10 – merge active
  { activeNodes: ["merge"], completeNodes: ["trigger", "validate", "condition", "taskA", "taskB"], connector: null, duration: 600 },
  // 11 – dot to done
  { activeNodes: ["merge"], completeNodes: ["trigger", "validate", "condition", "taskA", "taskB"], connector: "merge-done", duration: 700 },
  // 12 – done active
  { activeNodes: ["done"], completeNodes: ["trigger", "validate", "condition", "taskA", "taskB", "merge"], connector: null, duration: 800 },
  // 13 – everything complete, pause
  { activeNodes: [], completeNodes: ["trigger", "validate", "condition", "taskA", "taskB", "merge", "done"], connector: null, duration: 1200 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function WorkflowGraph() {
  const [stepIdx, setStepIdx] = useState(0);
  const [dotProgress, setDotProgress] = useState(0);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const startRef = useRef<number | null>(null);
  const prefersReduced = useRef(false);

  useEffect(() => {
    prefersReduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  useEffect(() => {
    if (prefersReduced.current) return;

    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const step = STEPS[stepIdx]!;
      const progress = Math.min(elapsed / step.duration, 1);
      setDotProgress(progress);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        startRef.current = null;
        setStepIdx((i) => (i + 1) % STEPS.length);
        setDotProgress(0);
      }
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [stepIdx]);

  const step = STEPS[stepIdx]!;

  function getNodeState(id: NodeId): NodeState {
    if (step.activeNodes.includes(id)) return "active";
    if (step.completeNodes.includes(id)) return "complete";
    return "idle";
  }

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      aria-hidden="true"
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
      }}
    >
      {/* Arrowhead marker */}
      <defs>
        <marker
          id="arrow-idle"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0.5 L0,5.5 L5,3 Z" fill={C.connector} />
        </marker>
        <marker
          id="arrow-active"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0.5 L0,5.5 L5,3 Z" fill={C.dot} />
        </marker>
      </defs>

      {/* Connectors */}
      {CONNECTORS.map((conn) => {
        const isActive = conn.id === step.connector;
        return (
          <React.Fragment key={conn.id}>
            <path
              d={conn.d}
              fill="none"
              stroke={C.connector}
              strokeWidth={1.25}
              strokeDasharray="4 3"
              markerEnd="url(#arrow-idle)"
            />
            {/* Travelling dot */}
            {isActive && (
              <TravellingDot
                pathDef={conn.d}
                progress={dotProgress}
                color={C.dot}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Nodes */}
      {NODES.map((node) => {
        const state = getNodeState(node.id);
        const x = nodeX(node.cx);
        const y = nodeY(node.cy);
        const isDone = node.id === "done" && state === "active";

        const borderColor =
          state === "active"
            ? isDone
              ? C.nodeCompleteBorder
              : C.nodeActiveBorder
            : state === "complete"
            ? C.nodeCompleteBorder
            : C.nodeBorder;

        const iconColor =
          state === "active"
            ? C.iconActive
            : state === "complete"
            ? C.iconComplete
            : C.iconIdle;

        const glowColor =
          state === "active"
            ? isDone
              ? C.nodeDoneGlow
              : C.nodeActiveGlow
            : state === "complete"
            ? "transparent"
            : "transparent";

        return (
          <g key={node.id}>
            {/* Subtle glow */}
            {state === "active" && (
              <rect
                x={x - 4}
                y={y - 4}
                width={NW + 8}
                height={NH + 8}
                rx={NR + 3}
                fill={glowColor}
              />
            )}
            {/* Node body */}
            <rect
              x={x}
              y={y}
              width={NW}
              height={NH}
              rx={NR}
              fill={C.nodeBg}
              stroke={borderColor}
              strokeWidth={state !== "idle" ? 1.5 : 1}
              style={{
                transition: "stroke 0.4s ease, stroke-width 0.3s ease",
              }}
            />
            {/* Icon area */}
            <NodeIcon
              Icon={node.Icon}
              cx={x + 20}
              cy={node.cy}
              color={iconColor}
            />
            {/* Label */}
            <text
              x={x + 36}
              y={node.cy - 5}
              fontSize={11}
              fontWeight={500}
              fill={state !== "idle" ? C.label : "#888887"}
              fontFamily="system-ui, -apple-system, sans-serif"
              style={{ transition: "fill 0.4s ease" }}
            >
              {node.label}
            </text>
            {/* Sublabel */}
            <text
              x={x + 36}
              y={node.cy + 9}
              fontSize={9}
              fill={C.sublabel}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {node.sublabel}
            </text>
            {/* Complete checkmark dot */}
            {state === "complete" && (
              <circle
                cx={x + NW - 10}
                cy={y + 10}
                r={4}
                fill={C.dotComplete}
                opacity={0.85}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Travelling dot sub-component (uses getPointAtLength for smooth motion)
// ---------------------------------------------------------------------------
interface TravellingDotProps {
  pathDef: string;
  progress: number;
  color: string;
}

function TravellingDot({ pathDef, progress, color }: TravellingDotProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Recompute position whenever pathDef or progress changes
  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    const pt = el.getPointAtLength(len * easeInOut(progress));
    setPos({ x: pt.x, y: pt.y });
  }, [pathDef, progress]);

  return (
    <>
      {/* Hidden path just for measurement */}
      <path ref={pathRef} d={pathDef} fill="none" stroke="none" />
      {pos && (
        <circle cx={pos.x} cy={pos.y} r={4} fill={color} opacity={0.9} />
      )}
    </>
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ---------------------------------------------------------------------------
// Inline SVG icon renderer (avoids importing React components into SVG)
// ---------------------------------------------------------------------------
interface NodeIconProps {
  Icon: React.ElementType;
  cx: number;
  cy: number;
  color: string;
}

function NodeIcon({ Icon, cx, cy, color }: NodeIconProps) {
  return (
    <foreignObject x={cx - 8} y={cy - 8} width={16} height={16}>
      <div
        // @ts-expect-error xmlns is valid on SVG foreignObject content
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          color,
          transition: "color 0.4s ease",
        }}
      >
        <Icon size={14} strokeWidth={1.75} />
      </div>
    </foreignObject>
  );
}
