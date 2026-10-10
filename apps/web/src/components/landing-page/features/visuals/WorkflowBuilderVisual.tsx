"use client";

import React from "react";
import { Webhook, GitBranch, MessageCircle, Globe, GitMerge } from "lucide-react";

// Shared palette
const C = {
  bg: "#1c1c1c",
  nodeBg: "#252525",
  nodeBorder: "#363636",
  nodeActiveBorder: "#c4a96b",
  nodeMuted: "#2e2e2e",
  label: "#d0d0cc",
  labelMuted: "#6e6e6b",
  sublabel: "#595956",
  connector: "#383836",
  connectorActive: "#c4a96b",
  dot: "#c4a96b",
  green: "#7cb87c",
  iconIdle: "#525250",
  iconActive: "#d4b97a",
} as const;

// viewBox dimensions
const VW = 480;
const VH = 320;
const NW = 130;
const NH = 40;
const NR = 7;

function nx(cx: number) { return cx - NW / 2; }
function ny(cy: number) { return cy - NH / 2; }

// Node centres
const CX = VW / 2;
const CX_L = 135;
const CX_R = VW - 135;
const Y = { trigger: 36, condition: 120, left: 210, right: 210, merge: 294 };

// Paths
function vline(x1: number, y1: number, x2: number, y2: number) {
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

const paths = {
  trig_cond: vline(CX, Y.trigger + NH / 2, CX, Y.condition - NH / 2),
  cond_left: vline(CX, Y.condition + NH / 2, CX_L, Y.left - NH / 2),
  cond_right: vline(CX, Y.condition + NH / 2, CX_R, Y.right - NH / 2),
  left_merge: vline(CX_L, Y.left + NH / 2, CX, Y.merge - NH / 2),
  right_merge: vline(CX_R, Y.right + NH / 2, CX, Y.merge - NH / 2),
};

interface NodeProps {
  cx: number;
  cy: number;
  label: string;
  sub: string;
  Icon: React.ElementType;
  active?: boolean;
  dim?: boolean;
}

function Node({ cx, cy, label, sub, Icon, active, dim }: NodeProps) {
  const x = nx(cx);
  const y = ny(cy);
  const border = active ? C.nodeActiveBorder : C.nodeBorder;
  const iconColor = active ? C.iconActive : dim ? C.sublabel : C.iconIdle;
  const textColor = active ? C.label : dim ? C.sublabel : "#9a9a97";
  const subColor = dim ? "#444" : C.sublabel;
  return (
    <g>
      <rect x={x} y={y} width={NW} height={NH} rx={NR}
        fill={dim ? "#1e1e1e" : C.nodeBg} stroke={border} strokeWidth={active ? 1.5 : 1} />
      <foreignObject x={x + 9} y={cy - 8} width={16} height={16}>
        <div 
          style={{ display: "flex", alignItems: "center", justifyContent: "center",
            width: 16, height: 16, color: iconColor }}>
          <Icon size={12} strokeWidth={1.75} />
        </div>
      </foreignObject>
      <text x={x + 30} y={cy - 3} fontSize={9.5} fontWeight={500} fill={textColor}
        fontFamily="system-ui, sans-serif">{label}</text>
      <text x={x + 30} y={cy + 9} fontSize={8} fill={subColor}
        fontFamily="system-ui, sans-serif">{sub}</text>
    </g>
  );
}

export function WorkflowBuilderVisual() {
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true"
      style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width={VW} height={VH} rx={10} fill={C.bg} />

      {/* Connectors – active path is trigger → condition → right branch → merge */}
      {Object.entries(paths).map(([key, d]) => {
        const isActive = key === "trig_cond" || key === "cond_right" || key === "right_merge";
        return (
          <path key={key} d={d} fill="none"
            stroke={isActive ? C.connectorActive : C.connector}
            strokeWidth={isActive ? 1.25 : 1}
            strokeDasharray={isActive ? undefined : "3 3"} />
        );
      })}

      {/* Small arrowheads */}
      {[
        { cx: CX, cy: Y.condition - NH / 2, active: true },
        { cx: CX_L, cy: Y.left - NH / 2, active: false },
        { cx: CX_R, cy: Y.right - NH / 2, active: true },
        { cx: CX, cy: Y.merge - NH / 2, active: true },
      ].map(({ cx, cy, active }, i) => (
        <polygon key={i}
          points={`${cx - 4},${cy - 1} ${cx + 4},${cy - 1} ${cx},${cy + 5}`}
          fill={active ? C.connectorActive : C.connector} opacity={0.7} />
      ))}

      {/* Nodes */}
      <Node cx={CX} cy={Y.trigger} label="Webhook Trigger" sub="POST /run" Icon={Webhook} active />
      <Node cx={CX} cy={Y.condition} label="Condition" sub="Route by type" Icon={GitBranch} active />
      <Node cx={CX_L} cy={Y.left} label="Notify" sub="Send message" Icon={MessageCircle} dim />
      <Node cx={CX_R} cy={Y.right} label="HTTP Request" sub="POST api.example" Icon={Globe} active />
      <Node cx={CX} cy={Y.merge} label="Merge" sub="Collect outputs" Icon={GitMerge} active />

      {/* Active path indicator dot */}
      <circle cx={CX_R} cy={Y.right - NH / 2 - 8} r={3.5}
        fill={C.dot} opacity={0.9} />

      {/* Label badge */}
      <rect x={VW - 104} y={VH - 22} width={96} height={15} rx={4}
        fill="rgba(196,169,107,0.1)" stroke="rgba(196,169,107,0.3)" strokeWidth={0.75} />
      <text x={VW - 56} y={VH - 12} fontSize={7.5} fill={C.dot} textAnchor="middle"
        fontFamily="system-ui, sans-serif" fontWeight={500}>
        Active execution path
      </text>
    </svg>
  );
}
