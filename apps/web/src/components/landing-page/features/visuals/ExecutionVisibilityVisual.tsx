"use client";

import React from "react";
import { CheckCircle, AlertCircle, RefreshCw, Clock } from "lucide-react";

const C = {
  bg: "#1c1c1c",
  panelBg: "#212121",
  panelBorder: "#2e2e2e",
  rowHover: "#272727",
  label: "#c8c8c4",
  sublabel: "#6a6a67",
  green: "#7cb87c",
  amber: "#c4a96b",
  red: "#b05a5a",
  muted: "#444442",
  connector: "#363636",
} as const;

const VW = 480;
const VH = 320;

// Timeline entries – matches NodeRun fields: nodeType, status, startedAt, completedAt, retryCount
const RUNS = [
  { id: "1", node: "webhookTrigger",  label: "Webhook Trigger",  status: "SUCCESS", time: "07:12:01", dur: "12ms",  retries: 0 },
  { id: "2", node: "conditionNode",   label: "Condition",        status: "SUCCESS", time: "07:12:01", dur: "3ms",   retries: 0 },
  { id: "3", node: "httpTrigger",     label: "HTTP Request",     status: "SUCCESS", time: "07:12:01", dur: "340ms", retries: 0 },
  { id: "4", node: "slackNode",       label: "Slack",            status: "FAILED",  time: "07:12:02", dur: "2.1s",  retries: 2 },
  { id: "5", node: "logNode",         label: "Log",              status: "RUNNING", time: "07:12:04", dur: "—",     retries: 0 },
] as const;

type RunStatus = "SUCCESS" | "FAILED" | "RUNNING";

function statusIcon(s: RunStatus) {
  if (s === "SUCCESS") return <CheckCircle size={11} strokeWidth={1.75} />;
  if (s === "FAILED")  return <AlertCircle size={11} strokeWidth={1.75} />;
  return <RefreshCw size={11} strokeWidth={1.75} />;
}
function statusColor(s: RunStatus) {
  if (s === "SUCCESS") return C.green;
  if (s === "FAILED")  return C.red;
  return C.amber;
}
function statusLabel(s: RunStatus) {
  if (s === "SUCCESS") return "success";
  if (s === "FAILED")  return "failed";
  return "running";
}

export function ExecutionVisibilityVisual() {
  // Panel dimensions
  const panX = 18;
  const panY = 14;
  const panW = VW - 36;
  const panH = VH - 28;
  const rowH = 38;
  const headerH = 28;
  const colW = { time: 72, name: 144, dur: 54, retries: 48, status: panW - 72 - 144 - 54 - 48 };

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true"
      style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width={VW} height={VH} rx={10} fill={C.bg} />

      {/* Panel */}
      <rect x={panX} y={panY} width={panW} height={panH} rx={8}
        fill={C.panelBg} stroke={C.panelBorder} strokeWidth={1} />

      {/* Header row */}
      <rect x={panX} y={panY} width={panW} height={headerH} rx={8}
        fill="#1a1a1a" />
      <rect x={panX} y={panY + headerH - 1} width={panW} height={1} fill={C.panelBorder} />

      {/* Header labels */}
      {[
        { text: "Time",    x: panX + 10 },
        { text: "Step",    x: panX + colW.time + 10 },
        { text: "Status",  x: panX + colW.time + colW.name + 10 },
        { text: "Duration",x: panX + colW.time + colW.name + colW.status + 10 },
        { text: "Retries", x: panX + colW.time + colW.name + colW.status + colW.dur + 10 },
      ].map(({ text, x }) => (
        <text key={text} x={x} y={panY + headerH - 10} fontSize={7.5} fill={C.sublabel}
          fontFamily="system-ui, sans-serif" fontWeight={600}
          style={{ textTransform: "uppercase" as const }}>{text}</text>
      ))}

      {/* Rows */}
      {RUNS.map((run, i) => {
        const rowY = panY + headerH + i * rowH;
        const isLast = i === RUNS.length - 1;
        const color = statusColor(run.status as RunStatus);
        const isRunning = run.status === "RUNNING";
        return (
          <g key={run.id}>
            {/* Row bg */}
            <rect x={panX + 1} y={rowY} width={panW - 2} height={rowH}
              fill={isRunning ? "rgba(196,169,107,0.05)" : "transparent"} />
            {/* Row bottom border */}
            {!isLast && (
              <line x1={panX + 16} y1={rowY + rowH} x2={panX + panW - 16} y2={rowY + rowH}
                stroke={C.panelBorder} strokeWidth={0.75} />
            )}

            {/* Time */}
            <text x={panX + 10} y={rowY + rowH / 2 + 3.5} fontSize={8} fill={C.sublabel}
              fontFamily="ui-monospace, monospace">{run.time}</text>

            {/* Step name */}
            <text x={panX + colW.time + 10} y={rowY + rowH / 2 + 3.5} fontSize={9}
              fill={C.label} fontFamily="system-ui, sans-serif" fontWeight={500}>
              {run.label}
            </text>

            {/* Status icon + label */}
            <g transform={`translate(${panX + colW.time + colW.name + 10}, ${rowY + rowH / 2 - 6})`}>
              <foreignObject x={0} y={0} width={14} height={14}>
                <div 
                  style={{ display: "flex", color, width: 14, height: 14, alignItems: "center" }}>
                  {statusIcon(run.status as RunStatus)}
                </div>
              </foreignObject>
              <text x={17} y={10} fontSize={8} fill={color}
                fontFamily="system-ui, sans-serif" fontWeight={500}>
                {statusLabel(run.status as RunStatus)}
              </text>
            </g>

            {/* Duration */}
            <text x={panX + colW.time + colW.name + colW.status + 10} y={rowY + rowH / 2 + 3.5}
              fontSize={8} fill={C.sublabel} fontFamily="ui-monospace, monospace">{run.dur}</text>

            {/* Retries */}
            {run.retries > 0 && (
              <g transform={`translate(${panX + colW.time + colW.name + colW.status + colW.dur + 10}, ${rowY + rowH / 2 - 6})`}>
                <foreignObject x={0} y={0} width={12} height={12}>
                  <div 
                    style={{ display: "flex", color: C.amber, width: 12, height: 12, alignItems: "center" }}>
                    <Clock size={9} strokeWidth={1.75} />
                  </div>
                </foreignObject>
                <text x={14} y={9} fontSize={8} fill={C.amber}
                  fontFamily="system-ui, sans-serif">{run.retries}×</text>
              </g>
            )}
          </g>
        );
      })}

      {/* "Running" indicator at bottom */}
      <rect x={panX + 10} y={panY + panH - 18} width={VW / 2} height={12} rx={3} fill="transparent" />
      <circle cx={panX + 16} cy={panY + panH - 11} r={3} fill={C.amber} opacity={0.8} />
      <text x={panX + 24} y={panY + panH - 7} fontSize={7.5} fill={C.sublabel}
        fontFamily="system-ui, sans-serif">
        Execution in progress · run_7f3a2c · started 07:12:01
      </text>
    </svg>
  );
}
