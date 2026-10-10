"use client";

import { GitBranch } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import { WorkflowNode } from "./WorkflowNode";

export function ConditionNode({ id, data }: NodeProps) {
  return (
    <WorkflowNode
      id={id}
      icon={<GitBranch className="size-4" aria-hidden="true" />}
      label={String(data.label ?? "Condition")}
      sourceHandles={[
        { id: "alert", style: { top: "15%" } },
        { id: "log", style: { top: "85%" } },
      ]}
    />
  );
}