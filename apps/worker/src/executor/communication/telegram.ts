import { parseTemplateWithMetadata } from "@WorkOrchestrator/shared/parser";
import { resolveCredentials } from "../../engine/credentials";
import type { NodeExecutionOutput, TelegramNodeData } from "../../engine/types";
import { formatMessage } from "./formatMessage";

export async function executeTelegramNode(
  data: TelegramNodeData,
  runMetadata: Record<string, NodeExecutionOutput>,
  ownerId: string,
): Promise<NodeExecutionOutput> {
  const credentialId = data.credentialId?.trim();
  if (!credentialId) throw new Error("Telegram bot credential is required");
  const chatId = data.chatId?.trim();
  if (!chatId) throw new Error("Telegram chat ID is required");
  if (!data.message?.trim()) throw new Error("Telegram message is required");

  const { platform, keys } = await resolveCredentials(credentialId, ownerId);
  if (platform !== "telegram") throw new Error("Selected credential is not a Telegram credential");
  const botToken = keys.botToken?.trim();
  if (!botToken) throw new Error("Telegram bot token is missing from the selected credential");

  const parsed = parseTemplateWithMetadata(data.message, runMetadata);
  if (parsed.missingVars?.length) {
    throw new Error(`Telegram message uses undefined variables: ${parsed.missingVars.join(", ")}`);
  }
  const message = formatMessage(parsed.output);
  if (!message) throw new Error("Telegram message is empty after template rendering");

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => null) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number; chat?: { id?: number; type?: string } };
  } | null;
  if (!response.ok || !result?.ok) {
    throw new Error(`Telegram sendMessage failed: ${result?.description || `HTTP ${response.status}`}`);
  }
  return {
    success: true,
    ...(result.result?.message_id !== undefined ? { messageId: result.result.message_id } : {}),
    chatId: result.result?.chat?.id ?? chatId,
    ...(result.result?.chat?.type ? { chatType: result.result.chat.type } : {}),
  };
}
