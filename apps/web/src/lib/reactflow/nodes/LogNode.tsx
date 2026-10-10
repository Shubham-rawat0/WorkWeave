"use client";

import { FileText } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import { WorkflowNode } from "./WorkflowNode";

export function LogNode({ id, data }: NodeProps) {
  return (
    <WorkflowNode
      id={id}
      icon={<FileText className="size-4" aria-hidden="true" />}
      label={String(data.label ?? "Log")}
    />
  );
}