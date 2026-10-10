"use client";

import { Zap } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import { WorkflowNode } from "./WorkflowNode";

export function ManualTriggerNode({ id, data }: NodeProps) {
  return (
    <WorkflowNode
      id={id}
      icon={<Zap className="size-4" aria-hidden="true" />}
      label={String(data.label ?? "Manual Trigger")}
    />
  );
}