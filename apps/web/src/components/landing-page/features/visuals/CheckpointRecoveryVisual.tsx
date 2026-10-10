"use client";

import React from "react";
import { CheckCircle, Save, Play, AlertCircle, Pause } from "lucide-react";

const C = {
  bg: "#1c1c1c",
  nodeBg: "#252525",
  nodeBorder: "#363636",
  connector: "#383836",
  label: "#d0d0cc",
  sublabel: "#595956",
  green: "#7cb87c",
  amber: "#c4a96b",
  muted: "#444442",
} as const;

const VW = 480;
const VH = 300;

// 5 steps in a linear horizontal timeline
const STEPS = [
  { label: "Fetch Data",    status: "done",        x: 48  },
  { label: "Transform",     status: "done",        x: 144 },
  { label: "Checkpoint",    status: "checkpoint",  x: 240 },
  { label: "Push Records",  status: "interrupted", x: 336 },
  { label: "Notify",        status: "pending",     x: 432 },
];

const STEP_Y = 120;
const R = 20;

type StepStatus = "done" | "checkpoint" | "interrupted" | "pending";

function statusColor(s: string) {
  if (s === "done") return C.green;
  if (s === "checkpoint") return C.amber;
  if (s === "interrupted") return "#b05a5a";
  return C.muted;
}
function statusStroke(s: string) {
  if (s === "done") return "#4a7a4a";
  if (s === "checkpoint") return "#7a6a3a";
  if (s === "interrupted") return "#7a3a3a";
  return C.nodeBorder;
}

export function CheckpointRecoveryVisual() {
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true"
      style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width={VW} height={VH} rx={10} fill={C.bg} />

      {/* Horizontal track */}
      {STEPS.slice(0, -1).map((step, i) => {
        const next = STEPS[i + 1]!;
        const fromX = step.x + R;
        const toX = next.x - R;
        const isCheckpointEdge = step.status === "checkpoint";
        return (
          <line key={i} x1={fromX} y1={STEP_Y} x2={toX} y2={STEP_Y}
            stroke={isCheckpointEdge ? C.amber : step.status === "done" ? C.green : C.nodeBorder}
            strokeWidth={1.5}
            strokeDasharray={step.status === "interrupted" || step.status === "pending" ? "4 3" : undefined} />
        );
      })}

      {/* Step circles */}
      {STEPS.map((step, i) => {
        const color = statusColor(step.status);
        const stroke = statusStroke(step.status);
        const isCheck = step.status === "checkpoint";
        const isDone = step.status === "done";
        const isInt = step.status === "interrupted";
        const isPend = step.status === "pending";
        return (
          <g key={i}>
            {/* Outer ring for checkpoint */}
            {isCheck && (
              <circle cx={step.x} cy={STEP_Y} r={R + 6}
                fill="none" stroke={C.amber} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
            )}
            <circle cx={step.x} cy={STEP_Y} r={R}
              fill={isDone ? "rgba(30,50,30,0.5)" : isCheck ? "rgba(100,80,20,0.25)"
                : isInt ? "rgba(80,30,30,0.4)" : C.nodeBg}
              stroke={stroke} strokeWidth={1.5} />

            {/* Icon */}
            <foreignObject x={step.x - 9} y={STEP_Y - 9} width={18} height={18}>
              <div 
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  color, width: 18, height: 18 }}>
                {isDone && <CheckCircle size={13} strokeWidth={1.75} />}
                {isCheck && <Save size={13} strokeWidth={1.75} />}
                {isInt && <AlertCircle size={13} strokeWidth={1.75} />}
                {isPend && <Pause size={13} strokeWidth={1.75} />}
              </div>
            </foreignObject>

            {/* Label below */}
            <text x={step.x} y={STEP_Y + R + 14} fontSize={8.5} fill={isPend ? C.muted : C.label}
              textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight={isPend ? 400 : 500}>
              {step.label}
            </text>
          </g>
        );
      })}

      {/* Checkpoint annotation */}
      <rect x={240 - 44} y={STEP_Y - R - 36} width={88} height={22} rx={5}
        fill="rgba(196,169,107,0.1)" stroke="rgba(196,169,107,0.35)" strokeWidth={0.75} />
      <text x={240} y={STEP_Y - R - 22} fontSize={7.5} fill={C.amber} textAnchor="middle"
        fontFamily="system-ui, sans-serif" fontWeight={600}>CHECKPOINT SAVED</text>
      <line x1={240} y1={STEP_Y - R - 14} x2={240} y2={STEP_Y - R - 2}
        stroke={C.amber} strokeWidth={0.75} strokeDasharray="2 2" />

      {/* Resume indicator */}
      <rect x={336 - 36} y={STEP_Y + R + 28} width={72} height={18} rx={5}
        fill="rgba(196,169,107,0.1)" stroke="rgba(196,169,107,0.3)" strokeWidth={0.75} />
      <foreignObject x={336 - 18} y={STEP_Y + R + 31} width={12} height={12}>
        <div 
          style={{ display: "flex", color: C.amber, width: 12, height: 12 }}>
          <Play size={10} strokeWidth={2} />
        </div>
      </foreignObject>
      <text x={336 + 2} y={STEP_Y + R + 40} fontSize={7.5} fill={C.amber}
        fontFamily="system-ui, sans-serif" fontWeight={600}>Resume here</text>

      {/* Legend */}
      {[
        { color: C.green, label: "Completed" },
        { color: C.amber, label: "Checkpoint" },
        { color: "#b05a5a", label: "Interrupted" },
        { color: C.muted, label: "Pending" },
      ].map(({ color, label }, i) => (
        <g key={i} transform={`translate(${16 + i * 110}, ${VH - 22})`}>
          <circle cx={5} cy={5} r={4} fill={color} />
          <text x={13} y={9} fontSize={8} fill={C.sublabel}
            fontFamily="system-ui, sans-serif">{label}</text>
        </g>
      ))}
    </svg>
  );
}
