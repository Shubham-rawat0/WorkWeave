import type { ReactNode } from "react";
import {
  Clock,
  FileText,
  Filter,
  GitBranch,
  Globe,
  MessageSquare,
  Timer,
  Wand2,
  Webhook,
  Zap,
} from "lucide-react";
import Github from "@lobehub/icons/es/Github";
import Notion from "@lobehub/icons/es/Notion";

export function getNodeIcon(type: string, size = 16): ReactNode {
  const logo = (src: string, alt = ""): ReactNode => (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
  switch (type) {
    case "manualTrigger":
    case "triggerNode":
      return <Zap size={size} className="text-amber-400" />;
    case "webhookTrigger":
      return <Webhook size={size} className="text-blue-400" />;
    case "cronTrigger":
      return <Clock size={size} className="text-purple-400" />;
    case "httpTrigger":
      return <Globe size={size} className="text-sky-400" />;
    case "githubNode":
      return <Github size={size} />;
    case "notionNode":
      return <Notion size={size} />;
    case "openaiNode":
    case "aiNode":
      return logo("/logo/openai.svg");
    case "geminiNode":
      return logo("/logo/gemini.svg");
    case "anthropicNode":
      return logo("/logo/anthropic.svg");
    case "slackNode":
      return logo("/logo/slack.svg", "Slack");
    case "telegramNode":
      return logo("/logo/telegram.svg", "Telegram");
    case "discordNode":
      return <MessageSquare size={size} className="text-indigo-400" />;
    case "conditionNode":
      return <GitBranch size={size} className="text-emerald-400" />;
    case "filterNode":
      return <Filter size={size} className="text-emerald-400" />;
    case "delayNode":
      return <Timer size={size} className="text-orange-400" />;
    case "logNode":
      return <FileText size={size} className="text-gray-400" />;
    case "transformNode":
      return <Wand2 size={size} className="text-pink-400" />;
    default:
      return <Globe size={size} className="text-gray-400" />;
  }
}
