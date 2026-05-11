"use client";

import { useEffect, useState } from "react";
import type { GatewayClient } from "./client";
import { subscribeGatewayEvent, useOptionalGatewayClient } from "./provider";
import { toDisplayLogLine, type GatewayLogEntry } from "./log-entry";

interface TaskLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

interface ConversationPayload {
  lines: string[];
}

function formatLogEntry(entry: TaskLogEntry): string {
  return `${entry.timestamp} ${entry.message}`;
}

async function fetchTaskLogs(taskId: string): Promise<string[]> {
  const res = await fetch(`/api/tasks/${taskId}/logs`);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to fetch logs (${res.status})`);
  }
  const data = (await res.json()) as TaskLogEntry[];
  return Array.isArray(data) ? data.map(formatLogEntry) : [];
}

async function fetchTaskConversation(
  gateway: GatewayClient,
  taskId: string,
): Promise<string[]> {
  const payload = await gateway.call<
    { taskId: string },
    ConversationPayload
  >("task.conversation.get", { taskId });
  return Array.isArray(payload?.lines) ? payload.lines : [];
}

export function useTaskLogStream(
  taskId: string,
  onStatusChange?: (status: string) => void,
) {
  const [lines, setLines] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLines([]);
    setLoaded(false);
    setError(null);

    fetchTaskLogs(taskId)
      .then((initial) => {
        if (cancelled) return;
        setLines(initial);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    const off = subscribeGatewayEvent((event, data) => {
      if (cancelled) return;

      if (event === "log.dashboard" || event === "log.console") {
        const d = data as {
          scope?: string;
          taskId?: string;
          entry?: GatewayLogEntry;
          line?: string;
        };
        const entry = d?.entry;
        const line = d?.line;
        if (
          d?.scope === "task" &&
          d?.taskId === taskId &&
          entry
        ) {
          setLines((prev) => [...prev, toDisplayLogLine(entry)]);
        } else if (
          d?.scope === "task" &&
          d?.taskId === taskId &&
          typeof line === "string"
        ) {
          // Backward compatibility for older gateway payloads.
          setLines((prev) => [...prev, line]);
        }
        return;
      }

      if (event === "task.result") {
        const d = data as { taskId?: string; status?: string };
        if (d?.taskId === taskId && typeof d?.status === "string") {
          onStatusChange?.(d.status);
        }
      }
    });

    return () => {
      cancelled = true;
      off();
    };
  }, [taskId, onStatusChange]);

  return { lines, loaded, error };
}

export function useTaskConversationStream(taskId: string) {
  const gateway = useOptionalGatewayClient();
  const [lines, setLines] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gateway) return;

    let cancelled = false;
    setLines([]);
    setLoaded(false);
    setError(null);

    fetchTaskConversation(gateway, taskId)
      .then((initial) => {
        if (cancelled) return;
        setLines(initial);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    const off = subscribeGatewayEvent((event, data) => {
      if (cancelled || event !== "task.terminal") return;
      const d = data as { taskId?: string; line?: string };
      if (d?.taskId !== taskId || typeof d?.line !== "string") return;
      const line = d.line;
      setLines((prev) => [...prev, line].filter((value): value is string => typeof value === "string"));
    });

    return () => {
      cancelled = true;
      off();
    };
  }, [gateway, taskId]);

  return { lines, loaded, error };
}
