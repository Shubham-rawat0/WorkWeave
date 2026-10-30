import { APICallError } from "ai";
import {
  classifyAgentError,
  serializeAgentError,
  type AgentErrorInfo,
} from "@WorkOrchestrator/shared/ai/errors";

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractAgentError(error: unknown): {
  message: string;
  statusCode?: number;
} {
  const parts: string[] = [];
  let statusCode: number | undefined;

  if (error instanceof Error) {
    parts.push(error.message);
  }

  if (APICallError.isInstance(error)) {
    statusCode = error.statusCode;
    if (error.responseBody) parts.push(error.responseBody);
    if (error.data !== undefined) parts.push(stringifyUnknown(error.data));
    if (error.cause instanceof Error) {
      parts.push(error.cause.message);
    } else if (error.cause !== undefined) {
      parts.push(stringifyUnknown(error.cause));
    }
  } else if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    statusCode = error.statusCode;
  }

  return {
    message: [...new Set(parts)].join("\n"),
    statusCode,
  };
}

export function getAgentErrorInfo(
  error: unknown,
  provider: string,
): AgentErrorInfo {
  const extracted = extractAgentError(error);
  return classifyAgentError({
    ...extracted,
    provider,
    detail: extracted.message,
  });
}

export function formatAgentErrorForClient(
  error: unknown,
  provider: string,
): string {
  return serializeAgentError(getAgentErrorInfo(error, provider));
}
