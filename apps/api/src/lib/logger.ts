type LogContext = Record<string, unknown>;
type LogLevel = "error" | "warn";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  try {
    return { value: JSON.stringify(error) };
  } catch {
    return { value: String(error) };
  }
}

function write(
  level: LogLevel,
  scope: string,
  message: string,
  error?: unknown,
  context?: LogContext,
) {
  const payload = {
    level,
    scope,
    message,
    timestamp: new Date().toISOString(),
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else {
    console.warn(line);
  }
}

export const logger = {
  error(scope: string, message: string, error?: unknown, context?: LogContext) {
    write("error", scope, message, error, context);
  },
  warn(scope: string, message: string, error?: unknown, context?: LogContext) {
    write("warn", scope, message, error, context);
  },
};
