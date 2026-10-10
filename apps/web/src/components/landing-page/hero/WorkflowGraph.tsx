"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
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
// Design tokens
// ---------------------------------------------------------------------------
const C = {
  nodeBg: "#222222",
  nodeBorder: "#333333",
  nodeActiveBorder: "#c4a96b",
  nodeCompleteBorder: "#4f6f4f",
  glow: "rgba(196,169,107,0.22)",
  label: "#d6d6d2",
  labelIdle: "#8a8a87",
  sublabel: "#6b6b68",
  connector: "#3a3a38",
  dot: "#c4a96b",
  lineDone: "#5f8f5f",
  green: "#7cb87c",
  iconIdle: "#5a5a57",
  iconActive: "#e0c98a",
  iconComplete: "#7cb87c",
  chipIdle: "#2b2b29",
  chipActive: "rgba(196,169,107,0.16)",
  chipComplete: "rgba(124,184,124,0.14)",
} as const;

// ---------------------------------------------------------------------------
// Layout – 800 × 700 viewBox (previously 560 × 420)
// ---------------------------------------------------------------------------
const VW = 800;
const VH = 700;

const NW = 216; // node width
const NH = 64; // node height
const NR = 14; // corner radius

const Y = {
  trigger: 50,
  validate: 165,
  condition: 280,
  branch: 410,
  merge: 525,
  done: 640,
} as const;

const CX_MAIN = VW / 2;
const CX_LEFT = 190;
const CX_RIGHT = VW - 190;

// ---------------------------------------------------------------------------
// Nodes
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
  { id: "trigger", label: "Webhook", sublabel: "POST /trigger", cx: CX_MAIN, cy: Y.trigger, Icon: Webhook },
  { id: "validate", label: "Validate Request", sublabel: "Schema · Auth", cx: CX_MAIN, cy: Y.validate, Icon: ShieldCheck },
  { id: "condition", label: "Condition", sublabel: "Route by type", cx: CX_MAIN, cy: Y.condition, Icon: GitBranch },
  { id: "taskA", label: "Sync Database", sublabel: "Write records", cx: CX_LEFT, cy: Y.branch, Icon: Database },
  { id: "taskB", label: "Notify API", sublabel: "Send webhook", cx: CX_RIGHT, cy: Y.branch, Icon: Globe },
  { id: "merge", label: "Merge Results", sublabel: "Collect outputs", cx: CX_MAIN, cy: Y.merge, Icon: GitMerge },
  { id: "done", label: "Completed", sublabel: "Run finished", cx: CX_MAIN, cy: Y.done, Icon: CheckCircle },
];

const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<
  NodeId,
  NodeDef
>;

// ---------------------------------------------------------------------------
// Connectors – each ends 6px above the target so an arrowhead can sit on top
// ---------------------------------------------------------------------------
const ARROW = 6;

interface ConnectorDef {
  id: string;
  from: NodeId;
  to: NodeId;
  x1: number;
  y1: number;
  x2: number;
  y2: number; // node top edge (arrow tip)
  d: string;
}

function makeConnector(from: NodeId, to: NodeId): ConnectorDef {
  const a = NODE_BY_ID[from];
  const b = NODE_BY_ID[to];
  const x1 = a.cx;
  const y1 = a.cy + NH / 2;
  const x2 = b.cx;
  const y2 = b.cy - NH / 2;
  const endY = y2 - ARROW;
  const k = Math.max(28, (endY - y1) * 0.5);
  return {
    id: `${from}-${to}`,
    from,
    to,
    x1,
    y1,
    x2,
    y2,
    d: `M ${x1} ${y1} C ${x1} ${y1 + k}, ${x2} ${endY - k}, ${x2} ${endY}`,
  };
}

const CONNECTORS: ConnectorDef[] = [
  makeConnector("trigger", "validate"),
  makeConnector("validate", "condition"),
  makeConnector("condition", "taskA"),
  makeConnector("condition", "taskB"),
  makeConnector("taskA", "merge"),
  makeConnector("taskB", "merge"),
  makeConnector("merge", "done"),
];

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
interface AnimStep {
  activeNodes: NodeId[];
  completeNodes: NodeId[];
  /** connectors with a dot travelling along them during this step */
  connectors: string[];
  duration: number;
}

const ALL: NodeId[] = ["trigger", "validate", "condition", "taskA", "taskB", "merge", "done"];

const STEPS: AnimStep[] = [
  { activeNodes: [], completeNodes: [], connectors: [], duration: 800 },
  { activeNodes: ["trigger"], completeNodes: [], connectors: [], duration: 650 },
  { activeNodes: ["trigger"], completeNodes: [], connectors: ["trigger-validate"], duration: 750 },
  { activeNodes: ["validate"], completeNodes: ["trigger"], connectors: [], duration: 650 },
  { activeNodes: ["validate"], completeNodes: ["trigger"], connectors: ["validate-condition"], duration: 750 },
  { activeNodes: ["condition"], completeNodes: ["trigger", "validate"], connectors: [], duration: 650 },
  // both branches fire at the same time
  { activeNodes: ["condition"], completeNodes: ["trigger", "validate"], connectors: ["condition-taskA", "condition-taskB"], duration: 850 },
  { activeNodes: ["taskA", "taskB"], completeNodes: ["trigger", "validate", "condition"], connectors: [], duration: 1100 },
  { activeNodes: ["taskA", "taskB"], completeNodes: ["trigger", "validate", "condition"], connectors: ["taskA-merge", "taskB-merge"], duration: 850 },
  { activeNodes: ["merge"], completeNodes: ["trigger", "validate", "condition", "taskA", "taskB"], connectors: [], duration: 750 },
  { activeNodes: ["merge"], completeNodes: ["trigger", "validate", "condition", "taskA", "taskB"], connectors: ["merge-done"], duration: 750 },
  { activeNodes: ["done"], completeNodes: ["trigger", "validate", "condition", "taskA", "taskB", "merge"], connectors: [], duration: 900 },
  { activeNodes: [], completeNodes: ALL, connectors: [], duration: 1800 },
];

const FINAL_STEP = STEPS[STEPS.length - 1]!;

type NodeState = "idle" | "active" | "complete";
type ConnState = "idle" | "flowing" | "done";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function WorkflowGraph({ showGrid = true }: { showGrid?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [inView, setInView] = useState(true);
  const [reduced, setReduced] = useState(false);

  // Respect prefers-reduced-motion (show the finished state, no loop)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Pause the loop while the graph is off-screen
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? true),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Step machine: React state only changes once per step (not every frame)
  useEffect(() => {
    if (reduced || !inView) return;
    const t = setTimeout(
      () => setStepIdx((i) => (i + 1) % STEPS.length),
      STEPS[stepIdx]!.duration,
    );
    return () => clearTimeout(t);
  }, [stepIdx, reduced, inView]);

  const step = reduced ? FINAL_STEP : STEPS[stepIdx]!;
  const flowSeconds = (step.duration / 1000) * 0.9;

  const nodeState = (id: NodeId): NodeState =>
    step.activeNodes.includes(id)
      ? "active"
      : step.completeNodes.includes(id)
        ? "complete"
        : "idle";

  const connState = (c: ConnectorDef): ConnState => {
    if (step.connectors.includes(c.id)) return "flowing";
    const toState = nodeState(c.to);
    return toState !== "idle" ? "done" : "idle";
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
    >
      <defs>
        <filter id={`${uid}-blur`} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <pattern id={`${uid}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#ffffff" opacity="0.05" />
        </pattern>
      </defs>

      {showGrid && (
        <rect x={-40} y={-20} width={VW + 80} height={VH + 40} fill={`url(#${uid}-grid)`} />
      )}

      {CONNECTORS.map((c) => (
        <Connector
          key={c.id}
          def={c}
          state={connState(c)}
          duration={flowSeconds}
          blurId={`${uid}-blur`}
        />
      ))}

      {NODES.map((n) => (
        <Node key={n.id} def={n} state={nodeState(n.id)} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Connector: dashed base, progress line that "draws in", glowing travelling dot
// ---------------------------------------------------------------------------
function Connector({
  def,
  state,
  duration,
  blurId,
}: {
  def: ConnectorDef;
  state: ConnState;
  duration: number;
  blurId: string;
}) {
  const baseRef = useRef<SVGPathElement | null>(null);
  const progress = useMotionValue(0);

  // The same motion value drives the drawn line and the dot position,
  // so neither causes a React re-render while animating.
  useEffect(() => {
    if (state === "flowing") {
      progress.set(0);
      const controls = animate(progress, 1, {
        duration,
        ease: [0.45, 0, 0.2, 1],
      });
      return () => controls.stop();
    }
    if (state === "done") progress.set(1);
    // "idle": keep the value; the line just fades out
  }, [state, duration, progress]);

  const pointAt = (p: number) => {
    const el = baseRef.current;
    if (!el) return { x: def.x1, y: def.y1 };
    return el.getPointAtLength(el.getTotalLength() * p);
  };
  const dotX = useTransform(progress, (p) => pointAt(p).x);
  const dotY = useTransform(progress, (p) => pointAt(p).y);

  const lineColor = state === "done" ? C.lineDone : C.dot;
  const arrowColor =
    state === "idle" ? C.connector : state === "done" ? C.lineDone : C.dot;

  return (
    <g>
      <path
        ref={baseRef}
        d={def.d}
        fill="none"
        stroke={C.connector}
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <motion.path
        d={def.d}
        fill="none"
        strokeWidth={2}
        pathLength={progress}
        initial={false}
        animate={{ opacity: state === "idle" ? 0 : 1, stroke: lineColor }}
        transition={{ duration: 0.4 }}
      />
      <motion.path
        d={`M ${def.x2 - 4.5} ${def.y2 - ARROW - 1} L ${def.x2 + 4.5} ${def.y2 - ARROW - 1} L ${def.x2} ${def.y2} Z`}
        initial={false}
        animate={{ fill: arrowColor }}
        transition={{ duration: 0.4 }}
      />
      {state === "flowing" && (
        <>
          <motion.circle
            cx={dotX}
            cy={dotY}
            r={11}
            fill={C.dot}
            opacity={0.35}
            filter={`url(#${blurId})`}
          />
          <motion.circle cx={dotX} cy={dotY} r={4.5} fill={C.dot} />
        </>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------
function Node({ def, state }: { def: NodeDef; state: NodeState }) {
  const x = def.cx - NW / 2;
  const y = def.cy - NH / 2;
  const active = state === "active";
  const complete = state === "complete";

  const border = active
    ? C.nodeActiveBorder
    : complete
      ? C.nodeCompleteBorder
      : C.nodeBorder;
  const iconColor = active ? C.iconActive : complete ? C.iconComplete : C.iconIdle;
  const chipFill = active ? C.chipActive : complete ? C.chipComplete : C.chipIdle;

  const chipSize = 36;
  const chipX = x + 14;
  const chipY = def.cy - chipSize / 2;
  const statusX = x + NW - 24;

  return (
    // Quick "pop" each time a node becomes active
    <motion.g
      initial={false}
      animate={{ scale: active ? [1, 1.04, 1] : 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {/* Pulsing glow while running */}
      <motion.rect
        x={x - 7}
        y={y - 7}
        width={NW + 14}
        height={NH + 14}
        rx={NR + 7}
        fill={C.glow}
        initial={false}
        animate={active ? { opacity: [0.25, 0.85, 0.25] } : { opacity: 0 }}
        transition={
          active
            ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.4 }
        }
      />

      {/* Body */}
      <motion.rect
        x={x}
        y={y}
        width={NW}
        height={NH}
        rx={NR}
        fill={C.nodeBg}
        strokeWidth={1.5}
        initial={false}
        animate={{ stroke: border }}
        transition={{ duration: 0.4 }}
      />

      {/* Icon chip */}
      <motion.rect
        x={chipX}
        y={chipY}
        width={chipSize}
        height={chipSize}
        rx={10}
        initial={false}
        animate={{ fill: chipFill }}
        transition={{ duration: 0.4 }}
      />
      <foreignObject x={chipX + 8} y={chipY + 8} width={20} height={20}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            color: iconColor,
            transition: "color 0.4s ease",
          }}
        >
          <def.Icon size={18} strokeWidth={1.75} />
        </div>
      </foreignObject>

      {/* Text */}
      <motion.text
        x={x + 62}
        y={def.cy - 3}
        fontSize={13.5}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
        initial={false}
        animate={{ fill: state === "idle" ? C.labelIdle : C.label }}
        transition={{ duration: 0.4 }}
      >
        {def.label}
      </motion.text>
      <text
        x={x + 62}
        y={def.cy + 13}
        fontSize={10.5}
        fill={C.sublabel}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {def.sublabel}
      </text>

      {/* Status: hollow ring → spinner → check */}
      <g transform={`translate(${statusX} ${def.cy})`}>
        {state === "idle" && (
          <circle r={4} fill="none" stroke={C.connector} strokeWidth={1.5} />
        )}
        {active && (
          <>
            <circle r={7} fill="none" stroke={C.connector} strokeWidth={2} />
            <motion.circle
              r={7}
              fill="none"
              stroke={C.dot}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="14 30"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
            />
          </>
        )}
        {complete && (
          <>
            <motion.circle
              r={9}
              fill={C.green}
              fillOpacity={0.16}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
            />
            <motion.path
              d="M -3.6 0.2 L -1 2.9 L 3.7 -2.7"
              fill="none"
              stroke={C.green}
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
            />
          </>
        )}
      </g>
    </motion.g>
  );
}