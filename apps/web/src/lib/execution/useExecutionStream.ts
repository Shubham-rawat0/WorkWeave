"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  connectExecutionStream,
  type ExecutionStreamBootstrap,
  type ExecutionStreamEvent,
  type ExecutionStreamState,
} from "./stream";

const EMPTY_EVENTS: ExecutionStreamEvent[] = [];

export function useExecutionStream(
  runId: string | null,
  initialEvents: ExecutionStreamEvent[] = EMPTY_EVENTS,
  initialBootstrap?: ExecutionStreamBootstrap,
) {
  const [events, setEvents] = useState(initialEvents);
  const [state, setState] = useState<ExecutionStreamState | "idle">(
    runId ? "connecting" : "idle",
  );
  const [connectionMessage, setConnectionMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setEvents(initialEvents);
    setConnectionMessage(null);
    if (!runId || typeof window === "undefined") {
      setState("idle");
      return;
    }
    if (
      initialEvents.some(
        (event) =>
          event.type === "workflow" &&
          (event.status === "Success" || event.status === "Failure"),
      )
    ) {
      setState("finished");
      return;
    }

    let firstConnection = true;
    setState("connecting");
    const disconnect = connectExecutionStream({
      getBootstrap: async () => {
        if (firstConnection && initialBootstrap) {
          firstConnection = false;
          return initialBootstrap;
        }
        firstConnection = false;
        const { stream } = await api.executionStream(runId);
        return stream;
      },
      onEvent: (event) => {
        if (event.type === "connected") return;
        if (event.type === "socket") {
          setConnectionMessage(
            typeof event.error === "string"
              ? event.error
              : typeof event.status === "string"
                ? `Stream status: ${event.status}`
                : "Websocket reported a connection issue.",
          );
          return;
        }
        setEvents((current) => [...current, event].slice(-500));
      },
      onState: (nextState, message) => {
        setState(nextState);
        setConnectionMessage(message ?? null);
      },
    });
    let cancelled = false;
    let refreshInProgress = false;
    const refreshRunState = async () => {
      if (cancelled || refreshInProgress) return;
      refreshInProgress = true;
      try {
        const run = await api.workflowRun(runId);
        if (cancelled) return;
        const snapshotEvents: ExecutionStreamEvent[] = [
          {
            type: "workflow",
            status: run.status,
            timestamp: new Date(run.finishedAt ?? run.createdAt).getTime(),
          },
          ...run.nodeRuns.map((nodeRun) => ({
            type: "node",
            nodeId: nodeRun.nodeId,
            nodeType: nodeRun.nodeType,
            status: nodeRun.status,
            timestamp: new Date(
              nodeRun.completedAt ?? nodeRun.startedAt,
            ).getTime(),
            ...(nodeRun.error ? { error: nodeRun.error } : {}),
            ...(nodeRun.output !== null ? { output: nodeRun.output } : {}),
          })),
        ];
        setEvents((current) => {
          const keys = new Set(
            current.map((event) =>
              event.type === "node"
                ? `${event.type}:${event.nodeId}:${event.status}`
                : `${event.type}:${event.status}`,
            ),
          );
          return [
            ...current,
            ...snapshotEvents.filter((event) => {
              const key =
                event.type === "node"
                  ? `${event.type}:${event.nodeId}:${event.status}`
                  : `${event.type}:${event.status}`;
              if (keys.has(key)) return false;
              keys.add(key);
              return true;
            }),
          ].slice(-500);
        });
        setConnectionMessage(null);
        if (run.status === "Success" || run.status === "Failure") {
          setState("finished");
          window.clearInterval(pollTimer);
          disconnect();
        }
      } catch (error) {
        if (!cancelled) {
          setConnectionMessage(
            error instanceof Error
              ? `Could not refresh run state: ${error.message}`
              : "Could not refresh run state.",
          );
        }
      } finally {
        refreshInProgress = false;
      }
    };
    const pollTimer = window.setInterval(() => {
      void refreshRunState();
    }, 2_000);
    void refreshRunState();

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      disconnect();
    };
  }, [initialBootstrap, initialEvents, runId]);

  return { events, state, connectionMessage };
}
