export type AgentErrorCode =
  | "quota_exhausted"
  | "rate_limited"
  | "invalid_credential"
  | "credential_unavailable"
  | "model_unavailable"
  | "context_too_long"
  | "content_blocked"
  | "timeout"
  | "network"
  | "provider_unavailable"
  | "invalid_conversation"
  | "workflow_unavailable"
  | "request_failed";

export type AgentErrorInfo = {
  code: AgentErrorCode;
  title: string;
  message: string;
  hint?: string;
  detail?: string;
  retryable: boolean;
};

type ClassifyAgentErrorInput = {
  message: string;
  statusCode?: number;
  provider?: string;
  detail?: string;
};

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  gemini: "Google",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

function getProviderLabel(provider?: string): string {
  return PROVIDER_LABELS[provider?.toLowerCase() ?? ""] ?? "AI provider";
}

export function sanitizeErrorDetail(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-***")
    .replace(/AIza[0-9A-Za-z_-]{8,}/g, "AIza***")
    .replace(/AQ\.[A-Za-z0-9._-]{8,}/g, "AQ.***")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1***")
    .replace(
      /((?:api[_-]?key|token|secret)["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi,
      "$1***",
    )
    .trim()
    .slice(0, 800);
}

function hasAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export function classifyAgentError({
  message,
  statusCode,
  provider,
  detail,
}: ClassifyAgentErrorInput): AgentErrorInfo {
  const providerLabel = getProviderLabel(provider);
  const rawDetail = sanitizeErrorDetail(detail ?? message);
  const text = `${message}\n${detail ?? ""}`.toLowerCase();

  if (
    hasAny(text, [
      /credential not found/,
      /credential has no api key/,
      /failed to read the selected credential/,
      /not a supported ai provider/,
    ])
  ) {
    const isMissingKey = /no api key/.test(text);
    const isUnsupported = /not a supported ai provider/.test(text);
    const isUnreadable = /failed to read/.test(text);
    return {
      code: "credential_unavailable",
      title: isUnsupported
        ? "Unsupported AI provider"
        : isMissingKey
          ? "Credential has no API key"
          : isUnreadable
            ? "Credential could not be read"
            : "Credential not found",
      message: isUnsupported
        ? "The selected credential is not supported by the AI agent."
        : isMissingKey
          ? "The selected credential does not contain an API key."
          : isUnreadable
            ? "The selected credential could not be decrypted."
            : "The selected credential no longer exists or is unavailable to this account.",
      hint: isMissingKey
        ? "Edit the credential and add its API key, then try again."
        : isUnreadable
          ? "Re-create the credential with a valid API key."
          : "Choose another credential or add a new one.",
      detail: rawDetail,
      retryable: false,
    };
  }

  if (
    hasAny(text, [
      /insufficient[_\s-]?quota/,
      /exceeded?\s+(?:your\s+)?(?:current\s+)?quota/,
      /quota\s+(?:has been\s+)?(?:exceeded|exhausted|reached)/,
      /out of quota/,
      /billing\s+(?:hard\s+)?limit/,
      /credit balance/,
      /resource_exhausted/,
    ]) ||
    (statusCode === 429 && /\bquota\b/.test(text))
  ) {
    return {
      code: "quota_exhausted",
      title: "AI quota exhausted",
      message: `The ${providerLabel} account for this credential has no remaining quota for the selected model.`,
      hint: "Check the provider's billing and usage limits, or select a different credential or model.",
      detail: rawDetail,
      retryable: false,
    };
  }

  if (
    statusCode === 429 ||
    hasAny(text, [
      /rate[_\s-]?limit/,
      /too many requests/,
      /requests per (?:minute|day|second)/,
      /\brpm\b/,
      /\btpm\b/,
    ])
  ) {
    return {
      code: "rate_limited",
      title: "AI provider rate limit reached",
      message: `The ${providerLabel} provider is temporarily limiting requests for this credential.`,
      hint: "Wait a moment and try again. If it keeps happening, check the provider's rate limits.",
      detail: rawDetail,
      retryable: true,
    };
  }

  if (
    hasAny(text, [
      /(?:invalid|unsupported|unknown|no such|missing)\s+(?:ai\s+)?model/,
      /model[^\n]*(?:not found|does not exist|is not supported|not supported|not available|unavailable|no access|permission|decommissioned|deprecated|invalid)/,
      /models\/[^\s"']+[^\n]*(?:not found|not supported|unavailable)/,
      /(?:not found|not supported|unavailable)[^\n]*model/,
    ])
  ) {
    return {
      code: "model_unavailable",
      title: "AI model unavailable",
      message: `The selected model is not available for this ${providerLabel} credential.`,
      hint: `Choose a different ${providerLabel} model or verify the model ID.`,
      detail: rawDetail,
      retryable: false,
    };
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    hasAny(text, [
      /incorrect api key/,
      /invalid api key/,
      /api key not valid/,
      /invalid x-api-key/,
      /unauthenticated/,
      /unauthorized/,
      /authentication/,
      /permission denied/,
      /invalid authentication/,
    ])
  ) {
    return {
      code: "invalid_credential",
      title: "Invalid AI credential",
      message: `The ${providerLabel} provider rejected the selected credential.`,
      hint: "Update or replace the API key for this credential, then try again.",
      detail: rawDetail,
      retryable: false,
    };
  }

  if (
    hasAny(text, [
      /context (?:length|window)/,
      /too many tokens/,
      /token count/,
      /token limit/,
      /maximum context/,
      /maximum (?:number )?tokens/,
      /prompt is too long/,
      /input is too long/,
      /string too long/,
    ])
  ) {
    return {
      code: "context_too_long",
      title: "Conversation too long",
      message: "This conversation exceeds the selected model's context window.",
      hint: "Clear the chat or choose a model with a larger context window.",
      detail: rawDetail,
      retryable: false,
    };
  }

  if (
    hasAny(text, [
      /content filter/,
      /content-filter/,
      /safety/,
      /responsible ai/,
      /recitation/,
      /prohibited/,
      /blocked[^\n]*(?:policy|content|safety)/,
    ])
  ) {
    return {
      code: "content_blocked",
      title: "Response blocked",
      message:
        "The provider blocked the response because of its safety or content policy.",
      hint: "Rephrase your request and try again.",
      detail: rawDetail,
      retryable: false,
    };
  }

  if (hasAny(text, [/timeout/, /timed out/, /etimedout/, /deadline exceeded/])) {
    return {
      code: "timeout",
      title: "AI request timed out",
      message: `The ${providerLabel} provider took too long to respond.`,
      hint: "Try again, or choose a faster model.",
      detail: rawDetail,
      retryable: true,
    };
  }

  if (
    hasAny(text, [
      /fetch failed/,
      /network/,
      /econnreset/,
      /econnrefused/,
      /enotfound/,
      /socket/,
      /connection (?:reset|refused|failed)/,
    ])
  ) {
    return {
      code: "network",
      title: "AI provider unreachable",
      message: "The server could not reach the AI provider.",
      hint: "Check the server's network connection and try again.",
      detail: rawDetail,
      retryable: true,
    };
  }

  if (
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    statusCode === 504 ||
    hasAny(text, [
      /service unavailable/,
      /internal server error/,
      /bad gateway/,
      /gateway timeout/,
      /overloaded/,
    ])
  ) {
    return {
      code: "provider_unavailable",
      title: "AI provider unavailable",
      message: `The ${providerLabel} provider returned a temporary error${
        statusCode ? ` (HTTP ${statusCode})` : ""
      }.`,
      hint: "Try again in a moment. If it persists, check the provider's status page.",
      detail: rawDetail,
      retryable: true,
    };
  }

  if (hasAny(text, [/invalid chat messages/, /system messages are not allowed/])) {
    return {
      code: "invalid_conversation",
      title: "Invalid conversation",
      message: "The chat history could not be processed.",
      hint: "Clear the chat and start a new request.",
      detail: rawDetail,
      retryable: false,
    };
  }

  if (/workflow not found/.test(text)) {
    return {
      code: "workflow_unavailable",
      title: "Workflow unavailable",
      message: "The selected workflow could not be found.",
      hint: "Choose a different workflow or refresh the page.",
      detail: rawDetail,
      retryable: false,
    };
  }

  return {
    code: "request_failed",
    title: "Agent request failed",
    message: `The agent could not complete this request${
      statusCode ? ` (HTTP ${statusCode})` : ""
    }.`,
    hint: "Try again. If the problem persists, share the request ID with support.",
    detail: rawDetail || undefined,
    retryable: true,
  };
}

export function serializeAgentError(info: AgentErrorInfo): string {
  return JSON.stringify(info);
}

export function parseAgentErrorText(text: string): AgentErrorInfo | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (
        parsed &&
        typeof parsed === "object" &&
        "code" in parsed &&
        "title" in parsed &&
        "message" in parsed &&
        typeof parsed.code === "string" &&
        typeof parsed.title === "string" &&
        typeof parsed.message === "string"
      ) {
        return parsed as AgentErrorInfo;
      }
    } catch {
      // Fall through to keyword classification.
    }
  }

  if (!trimmed) return null;
  return classifyAgentError({ message: trimmed });
}
