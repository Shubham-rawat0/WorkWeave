import type { NodeTypes } from "@xyflow/react";
import { WorkflowTypeNode } from "@/components/workflow/nodes/workflowTypeNode";

export const nodeTypes = {
  manualTrigger: WorkflowTypeNode,
  webhookTrigger: WorkflowTypeNode,
  cronTrigger: WorkflowTypeNode,
  httpTrigger: WorkflowTypeNode,
  githubNode: WorkflowTypeNode,
  notionNode: WorkflowTypeNode,
  openaiNode: WorkflowTypeNode,
  geminiNode: WorkflowTypeNode,
  anthropicNode: WorkflowTypeNode,
  slackNode: WorkflowTypeNode,
  telegramNode: WorkflowTypeNode,
  discordNode: WorkflowTypeNode,
  conditionNode: WorkflowTypeNode,
  filterNode: WorkflowTypeNode,
  delayNode: WorkflowTypeNode,
  logNode: WorkflowTypeNode,
  transformNode: WorkflowTypeNode,
  aiNode: WorkflowTypeNode,
  triggerNode: WorkflowTypeNode,
} satisfies NodeTypes;

export type NodeType = keyof typeof nodeTypes;
