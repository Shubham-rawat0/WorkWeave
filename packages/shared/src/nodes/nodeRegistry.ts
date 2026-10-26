export interface NodeDefinition{
    type : string;
    label: string;
    description: string;
    category: "triggers"|"utilities"|"integrations" | "logic";
    isTrigger?: boolean;
    MetaData:{
        title : string;
        subtitle: string;
    }
}

export type NodeCategory = NodeDefinition["category"]

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
    triggers: "Triggers",
    integrations: "Integrations",
    logic: "Logic & Control",
    utilities: "Utilities",
};

export const CATEGORY_ORDER: NodeCategory[] = [
    "triggers",
    "integrations",
    "logic",
    "utilities",
];

export const NODE_REGISTRY: NodeDefinition[] = [
    {
        type: "manualTrigger",
        label: "Manual Trigger",
        description: "Start the workflow manually",
        category: "triggers",
        isTrigger: true,
        MetaData: {
            title: "Trigger Configuration",
            subtitle: "Configure the manual trigger",
        },
    },
    {
        type: "webhookTrigger",
        label: "Webhook Trigger",
        description: "Runs workflow from external HTTP events",
        category: "triggers",
        isTrigger: true,
        MetaData: {
            title: "Webhook Trigger Configuration",
            subtitle: "Configure inbound webhook settings",
        },
    },
    {
        type: "cronTrigger",
        label: "Cron Trigger",
        description: "Runs workflow on a recurring schedule",
        category: "triggers",
        isTrigger: true,
        MetaData: {
            title: "Cron Trigger Configuration",
            subtitle: "Configure recurring schedule",
        },
    },
    {
        type: "httpTrigger",
        label: "HTTP Request",
        description: "Make an HTTP request",
        category: "integrations",
        isTrigger: false,
        MetaData: {
            title: "HTTP Configuration",
            subtitle: "Configure the HTTP request",
        },
    },
    {
        type: "githubNode",
        label: "GitHub",
        description: "Create and manage GitHub issues",
        category: "integrations",
        isTrigger: false,
        MetaData: {
            title: "GitHub Configuration",
            subtitle: "Configure GitHub issue operations",
        },
    },
    {
        type: "notionNode",
        label: "Notion",
        description: "Create and query Notion database pages",
        category: "integrations",
        isTrigger: false,
        MetaData: {
            title: "Notion Configuration",
            subtitle: "Configure Notion database page operations",
        },
    },
    {
        type: "openaiNode",
        label: "OpenAI",
        description: "Make a request to the OpenAI API",
        category: "integrations",
        isTrigger: false,
        MetaData: {
            title: "OpenAI Configuration",
            subtitle: "Configure the AI Model to use",
        },
    },
    {
        type: "geminiNode",
        label: "Gemini",
        description: "Make a request to the Gemini API",
        category: "integrations",
        isTrigger: false,
        MetaData: {
            title: "Gemini Configuration",
            subtitle: "Configure the AI Model to use",
        },
    },
    {
        type: "anthropicNode",
        label: "Anthropic",
        description: "Make a request to the Anthropic API",
        category: "integrations",
        isTrigger: false,
        MetaData: {
            title: "Anthropic Configuration",
            subtitle: "Configure the AI Model to use",
        },
    },
    {
        type: "slackNode",
        label: "Slack",
        description: "Make a request to the Slack API",
        category: "integrations",
        isTrigger: false,
        MetaData: {
            title: "Slack Configuration",
            subtitle: "Configure the Slack webhook to use",
        },
    },
    {
        type: "telegramNode",
        label: "Telegram",
        description: "Send a message to any Telegram chat using a bot",
        category: "integrations",
        isTrigger: false,
        MetaData: {
            title: "Telegram Configuration",
            subtitle: "Configure the bot, chat, and message",
        },
    },
    {
        type: "conditionNode",
        label: "Condition",
        description: "Branch workflow based on expression rules",
        category: "logic",
        isTrigger: false,
        MetaData: {
            title: "Condition Configuration",
            subtitle: "Configure routing logic and routes",
        },
    },
    {
        type: "filterNode",
        label: "Filter",
        description: "Pass or block data based on a condition",
        category: "logic",
        isTrigger: false,
        MetaData: {
            title: "Filter Configuration",
            subtitle: "Configure filter expression and operator",
        },
    },
    {
        type: "delayNode",
        label: "Delay",
        description: "Pause execution for a configured duration",
        category: "utilities",
        isTrigger: false,
        MetaData: {
            title: "Delay Configuration",
            subtitle: "Configure wait duration before continuing",
        },
    },
    {
        type: "logNode",
        label: "Log",
        description: "Write structured logs from workflow data",
        category: "utilities",
        isTrigger: false,
        MetaData: {
            title: "Log Configuration",
            subtitle: "Configure structured log output",
        },
    },
    {
        type: "transformNode",
        label: "Transform",
        description: "Reshape data using template expressions",
        category: "utilities",
        isTrigger: false,
        MetaData: {
            title: "Transform Configuration",
            subtitle: "Configure data transformation template",
        },
    },
];

const registryMap=new Map<string,NodeDefinition>(
    NODE_REGISTRY.map(node=>[node.type,node])
)

export function getNodeDef(node:string):NodeDefinition|undefined{
    return registryMap.get(node)
}

export function getNodesByCategory(): Record<NodeCategory,NodeDefinition[]> {
    const grouped: Record<NodeCategory, NodeDefinition[]> = {
        triggers: [],
        integrations: [],
        logic: [],
        utilities: [],
    };

    for (const node of NODE_REGISTRY){
        grouped[node.category].push(node)
    }
    return grouped
}
