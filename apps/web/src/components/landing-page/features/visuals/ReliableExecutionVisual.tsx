"use client";

import React from "react";
import { Webhook, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";

const C = {
  bg: "#1c1c1c",
  nodeBg: "#252525",
  nodeBorder: "#363636",
  label: "#d0d0cc",
  labelMuted: "#8a8a87",
  connector: "#383836",
  green: "#7cb87c",
  amber: "#c4a96b",
  red: "#b05a5a",
  sublabel: "#595956",
  iconIdle: "#525250",
} as const;

const VW = 480;
const VH = 320;
const NW = 134;
const NH = 42;
const NR = 7;

type NodeStatus = "done" | "running" | "failed" | "retrying" | "pending";

interface StatusDef {
  icon: React.ElementType;
  color: string;
  border: string;
  label: string;
}

const STATUS: Record<NodeStatus, StatusDef> = {
  done:     { icon: CheckCircle,  color: C.green, border: "#4a7a4a", label: "Success" },
  running:  { icon: RefreshCw,    color: C.amber, border: "#7a6a3a", label: "Running" },
  failed:   { icon: AlertCircle,  color: C.red,   border: "#7a3a3a", label: "Failed" },
  retrying: { icon: RefreshCw,    color: C.amber, border: "#7a6a3a", label: "Retry 2/3" },
  pending:  { icon: Clock,        color: C.sublabel, border: C.nodeBorder, label: "Pending" },
};

interface NodeItem {
  label: string;
  sub: string;
  cx: number;
  cy: number;
  status: NodeStatus;
}

const NODES: NodeItem[] = [
  { label: "Webhook Trigger", sub: "Received event", cx: VW / 2, cy: 44, status: "done" },
  { label: "Transform Data",  sub: "Reshape payload", cx: VW / 2, cy: 126, status: "done" },
  { label: "Notify Slack",    sub: "Send message",   cx: VW / 2, cy: 210, status: "failed" },
  { label: "Notify Slack",    sub: "Send message",   cx: VW / 2, cy: 289, status: "retrying" },
];

function vpath(y1: number, y2: number) {
  const x = VW / 2;
  const m = (y1 + y2) / 2;
  return `M ${x} ${y1} C ${x} ${m}, ${x} ${m}, ${x} ${y2}`;
}

function FeatureNode({ label, sub, cx, cy, status }: NodeItem) {
  const def = STATUS[status];
  const x = cx - NW / 2;
  const y = cy - NH / 2;
  const isDone = status === "done";
  const isBad = status === "failed";
  const bgColor = isBad ? "rgba(80,30,30,0.4)" : isDone ? "rgba(30,50,30,0.35)" : C.nodeBg;
  return (
    <g>
      <rect x={x} y={y} width={NW} height={NH} rx={NR}
        fill={bgColor} stroke={def.border} strokeWidth={1.25} />
      {/* Status dot */}
      <circle cx={x + NW - 14} cy={cy} r={5} fill={def.color} opacity={0.85} />
      {/* Icon */}
      <foreignObject x={x + 10} y={cy - 9} width={18} height={18}>
        <div 
          style={{ display: "flex", alignItems: "center", color: def.color, width: 18, height: 18 }}>
          <def.icon size={13} strokeWidth={1.75} />
        </div>
      </foreignObject>
      {/* Text */}
      <text x={x + 33} y={cy - 4} fontSize={9.5} fontWeight={500} fill={C.label}
        fontFamily="system-ui, sans-serif">{label}</text>
      <text x={x + 33} y={cy + 8} fontSize={8} fill={C.sublabel}
        fontFamily="system-ui, sans-serif">{sub}</text>
      {/* Status pill */}
      <rect x={x + NW - 44} y={y + NH - 12} width={38} height={10} rx={3}
        fill="rgba(0,0,0,0.35)" />
      <text x={x + NW - 25} y={y + NH - 4} fontSize={6.5} fill={def.color}
        textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight={600}>
        {def.label}
      </text>
    </g>
  );
}

export function ReliableExecutionVisual() {
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true"
      style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width={VW} height={VH} rx={10} fill={C.bg} />

      {/* Connectors */}
      {NODES.slice(0, -1).map((n, i) => {
        const next = NODES[i + 1]!;
        const fromY = n.cy + NH / 2;
        const toY = next.cy - NH / 2;
        const isRetryEdge = i === 2; // failed → retry
        return (
          <g key={i}>
            <path d={vpath(fromY, toY)} fill="none"
              stroke={isRetryEdge ? C.amber : C.connector}
              strokeWidth={1} strokeDasharray={isRetryEdge ? "4 3" : undefined} />
            {/* Arrow */}
            <polygon
              points={`${VW / 2 - 3},${toY - 1} ${VW / 2 + 3},${toY - 1} ${VW / 2},${toY + 4}`}
              fill={isRetryEdge ? C.amber : C.connector} opacity={0.7} />
          </g>
        );
      })}

      {/* Retry badge on the third connector */}
      <rect x={VW / 2 + 8} y={(210 + NH / 2 + 289 - NH / 2) / 2 - 8} width={36} height={14} rx={4}
        fill="rgba(196,169,107,0.12)" stroke="rgba(196,169,107,0.35)" strokeWidth={0.75} />
      <text x={VW / 2 + 26} y={(210 + NH / 2 + 289 - NH / 2) / 2 + 2} fontSize={7}
        fill={C.amber} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight={600}>
        RETRY
      </text>

      {NODES.map((n, i) => <FeatureNode key={i} {...n} />)}
    </svg>
  );
}
