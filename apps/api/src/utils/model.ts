import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { HTTPException } from "hono/http-exception";

const SUPPORTED_AGENT_PLATFORMS = new Set([
  "google",
  "gemini",
  "openai",
  "anthropic",
]);

export function isSupportedAgentPlatform(provider: string): boolean {
  return SUPPORTED_AGENT_PLATFORMS.has(provider.trim().toLowerCase());
}

export function getAgentModel(model: string, provider: string, apiKey: string) {
  const normalizedModel = model.trim();
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedApiKey = apiKey.trim();

  if (!normalizedModel || !normalizedProvider || !normalizedApiKey) {
    throw new HTTPException(400, {
      message: "A valid model, provider, and API key are required.",
    });
  }

  if (normalizedProvider === "google" || normalizedProvider === "gemini") {
    return createGoogle({ apiKey: normalizedApiKey })(normalizedModel);
  }
  if (normalizedProvider === "openai") {
    return createOpenAI({ apiKey: normalizedApiKey })(normalizedModel);
  }
  if (normalizedProvider === "anthropic") {
    return createAnthropic({ apiKey: normalizedApiKey })(normalizedModel);
  }
  throw new HTTPException(400, { message: "Unsupported AI provider." });
}
