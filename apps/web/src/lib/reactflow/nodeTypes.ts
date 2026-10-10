import type { NodeTypes } from "@xyflow/react";
import { ManualTriggerNode } from "./nodes/ManualTriggerNode";
import { OpenAiNode } from "./nodes/OpenAiNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { SlackNode } from "./nodes/SlackNode";
import { LogNode } from "./nodes/LogNode";

export const nodeTypes: NodeTypes = {
  manualTrigger: ManualTriggerNode,
  openaiNode: OpenAiNode,
  conditionNode: ConditionNode,
  slackNode: SlackNode,
  logNode: LogNode,
};