export type ExecutionStreamEvent = {
  type: string;
  status?: string;
  nodeId?: string;
  nodeType?: string;
  timestamp?: number;
  error?: string;
  [key: string]: unknown;
};

export type ExecutionStreamBootstrap = {
  token: string;
  expiresInSeconds: number;
  wsUrl?: string;
};

export type ExecutionStreamState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "finished";

function getWebSocketUrl(wsUrl: string | undefined, token: string): string {
  const configuredUrl =
    wsUrl?.trim() ||
    process.env.NEXT_PUBLIC_EXECUTION_WS_URL?.trim() ||
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:3101`;
  const url = new URL(configuredUrl);
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error(`Unsupported websocket protocol: ${url.protocol}`);
  }
  if (!url.pathname.endsWith("/ws/executions")) {
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/ws/executions`;
  }
  url.searchParams.set("token", token);
  return url.toString();
}

export function connectExecutionStream({
  getBootstrap,
  onEvent,
  onState,
}: {
  getBootstrap: () => Promise<ExecutionStreamBootstrap>;
  onEvent: (event: ExecutionStreamEvent) => void;
  onState: (state: ExecutionStreamState, message?: string) => void;
}): () => void {
  let disposed = false;
  let finished = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stableConnectionTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let socket: WebSocket | null = null;

  const scheduleReconnect = (message?: string) => {
    if (disposed || finished || retryTimer) return;
    reconnectAttempt += 1;
    const delay = Math.min(30_000, 500 * 2 ** Math.min(reconnectAttempt - 1, 6));
    const jitteredDelay = Math.round(delay * (0.8 + Math.random() * 0.4));
    onState("reconnecting", message);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, jitteredDelay);
  };

  const connect = async () => {
    if (disposed || finished) return;
    onState(reconnectAttempt === 0 ? "connecting" : "reconnecting");

    try {
      const bootstrap = await getBootstrap();
      if (disposed || finished) return;
      const nextSocket = new WebSocket(
        getWebSocketUrl(bootstrap.wsUrl, bootstrap.token),
      );
      socket = nextSocket;

      nextSocket.addEventListener("open", () => {
        if (disposed || socket !== nextSocket) return;
        onState("connected");
        stableConnectionTimer = setTimeout(() => {
          if (!disposed && socket === nextSocket) reconnectAttempt = 0;
        }, 10_000);
      });

      nextSocket.addEventListener("message", (message) => {
        if (disposed || socket !== nextSocket) return;
        let event: ExecutionStreamEvent;
        try {
          const parsed: unknown = JSON.parse(String(message.data));
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            typeof (parsed as { type?: unknown }).type !== "string"
          ) {
            onState("reconnecting", "Received an invalid execution event.");
            return;
          }
          event = parsed as ExecutionStreamEvent;
        } catch {
          onState("reconnecting", "Could not parse an execution event.");
          return;
        }

        onEvent(event);
        if (
          event.type === "workflow" &&
          (event.status === "Success" || event.status === "Failure")
        ) {
          finished = true;
          if (stableConnectionTimer) clearTimeout(stableConnectionTimer);
          stableConnectionTimer = null;
          socket = null;
          onState("finished");
          nextSocket.close(1000, "Run finished");
        }
      });

      nextSocket.addEventListener("error", () => {
        if (!disposed && socket === nextSocket) {
          onState("reconnecting", "Websocket connection failed.");
        }
      });

      nextSocket.addEventListener("close", (event) => {
        if (disposed || socket !== nextSocket || finished) return;
        if (stableConnectionTimer) clearTimeout(stableConnectionTimer);
        stableConnectionTimer = null;
        socket = null;
        scheduleReconnect(
          event.reason || `Connection closed (${event.code}). Retrying…`,
        );
      });
    } catch (error) {
      if (disposed || finished) return;
      scheduleReconnect(
        error instanceof Error ? error.message : "Could not connect to event stream.",
      );
    }
  };

  void connect();

  return () => {
    disposed = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (stableConnectionTimer) clearTimeout(stableConnectionTimer);
    retryTimer = null;
    stableConnectionTimer = null;
    socket?.close(1000, "Viewer closed");
    socket = null;
  };
}
