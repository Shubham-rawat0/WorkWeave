"use client";

import type { NodeProps } from "@xyflow/react";
import { getNodeDef } from "@WorkOrchestrator/shared/nodeRegistry";
import { getNodeIcon } from "../nodeIcons";
import BaseNode from "./baseNode";

export function WorkflowTypeNode({
  id,
  type,
  data,
  selected,
}: NodeProps) {
  const definition = getNodeDef(type);
  const nodeData =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : {};
  const label =
    typeof nodeData.label === "string"
      ? nodeData.label
      : (definition?.label ?? type);
  const subtitle =
    typeof nodeData.subtitle === "string" ? nodeData.subtitle : "";
  const isTrigger = definition?.isTrigger ?? false;

  let sourceHandles:
    | Array<{ id: string; label?: string; top?: string }>
    | undefined;

  if (type === "conditionNode") {
    const explicitRoutes =
      Array.isArray(nodeData.routes) && nodeData.routes.length > 0
        ? nodeData.routes.map(String)
        : [];
    const ruleRoutes = Array.isArray(nodeData.rules)
      ? nodeData.rules.flatMap((rule) => {
          if (!rule || typeof rule !== "object") return [];
          const route = (rule as { route?: unknown }).route;
          return typeof route === "string" && route.trim() ? [route] : [];
        })
      : [];
    const defaultRoute =
      typeof nodeData.defaultRoute === "string" && nodeData.defaultRoute.trim()
        ? [nodeData.defaultRoute]
        : [];
    const routes = [
      ...new Set([
        ...(explicitRoutes.length > 0
          ? explicitRoutes
          : [...ruleRoutes, ...defaultRoute]),
        ...(explicitRoutes.length === 0 && ruleRoutes.length === 0
          ? ["alert", "log"]
          : []),
      ]),
    ];

    sourceHandles = routes.map((route, index) => ({
      id: route,
      label: route,
      top: `${((index + 1) / (routes.length + 1)) * 100}%`,
    }));
  }

  return (
    <BaseNode
      id={id}
      selected={selected}
      icon={getNodeIcon(type, 32)}
      label={label}
      subtitle={subtitle}
      isConfigured={nodeData.isConfigured !== false}
      isTrigger={isTrigger}
      nodeType={type}
      hideDefaultSourceHandle={type === "conditionNode"}
      sourceHandles={sourceHandles}
    />
  );
}
