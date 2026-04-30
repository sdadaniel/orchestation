"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { BusEventType } from "@orchestration/bus-types";
import { queryKeys } from "@/lib/query/query-keys";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { useTasksStore } from "@/store/tasksStore";
import { useLogsStore } from "@/store/logsStore";
import type { OrchestrationStatusData } from "@/orchestrate/orchestration-manager";
import { toDisplayLogLine, type GatewayLogEntry } from "./log-entry";

export function createEventHandlers(queryClient: QueryClient) {
  const invalidateTasksAndRequests = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
  };

  const handleTaskChanged = (data: unknown) => {
    const d = data as {
      full?: boolean;
      deleted?: boolean;
      taskId?: string;
      status?: string;
      priority?: string;
      title?: string;
      phase?: string | null;
    };
    if (d.full || d.deleted) {
      invalidateTasksAndRequests();
      useTasksStore.getState().fetchAll();
      return;
    }
    if (d.taskId) {
      const patch: Record<string, unknown> = {};
      if (d.status) patch.status = d.status;
      if (d.priority) patch.priority = d.priority;
      if (d.title) patch.title = d.title;
      if ("phase" in d) patch.phase = d.phase ?? null;
      const store = useTasksStore.getState();
      const exists = store.requests.some((r) => r.id === d.taskId);
      if (exists) store.patchRequest(d.taskId, patch as never);
      else store.fetchAll();
      invalidateTasksAndRequests();
    }
  };

  const handleOrchestrationStatus = (data: unknown) => {
    const statusData = data as OrchestrationStatusData;
    const store = useOrchestrationStore.getState();
    const prevStatus = store.data.status;
    const justFinished = prevStatus === "running" && statusData.status === "idle";

    useOrchestrationStore.setState(
      {
        data: statusData,
        isRunning: statusData.status === "running",
        justFinished: justFinished ? true : store.justFinished,
      },
      false,
      "orchestration/ws-update",
    );

    if (justFinished) {
      queryClient.invalidateQueries({ queryKey: queryKeys.costs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.runHistory.all });
    }

    useLogsStore.getState().setStatus(statusData.status);
  };

  const handleOrchestrateLogs = (data: unknown) => {
    const d = data as {
      scope?: string;
      entry?: GatewayLogEntry;
      line?: string;
      logs?: string[];
      total?: number;
    };

    if (d?.scope !== "orchestrate") return;

    if (d?.entry) {
      useLogsStore.getState().applyIncoming({
        logs: [toDisplayLogLine(d.entry)],
      });
      return;
    }
    if (typeof d?.line === "string") {
      // Backward compatibility for older gateway payloads.
      useLogsStore.getState().applyIncoming({ logs: [d.line] });
      return;
    }
    if (Array.isArray(d?.logs) || typeof d?.total === "number") {
      useLogsStore.getState().applyIncoming({ logs: d.logs, total: d.total });
    }
  };

  const handleConsoleLog = (data: unknown) => {
    const d = data as { entry?: GatewayLogEntry } | null;
    if (!d?.entry) return;
    console.log(toDisplayLogLine(d.entry));
  };

  const handlers: Partial<Record<BusEventType, (data: unknown, id: string) => void>> = {
    "task.changed": (data) => handleTaskChanged(data),
    "orchestration.status": (data) => handleOrchestrationStatus(data),
    "log.dashboard": (data) => handleOrchestrateLogs(data),
    "log.console": (data) => handleConsoleLog(data),
  };

  return {
    onEvent(eventType: BusEventType, data: unknown, _id: string) {
      useLogsStore.getState().markConnected();
      handlers[eventType]?.(data, _id);
    },

    onSnapshot(snapshot: unknown) {
      useLogsStore.getState().markConnected();
      const s = snapshot as {
        orchestration?: OrchestrationStatusData;
        tasksFullHint?: boolean;
      };
      if (s.orchestration) {
        useOrchestrationStore.setState(
          {
            data: s.orchestration,
            isRunning: s.orchestration.status === "running",
          },
          false,
          "orchestration/ws-snapshot",
        );

        useLogsStore.getState().setStatus(s.orchestration.status);
      }
      if (s.tasksFullHint) {
        useTasksStore.getState().fetchAll();
        invalidateTasksAndRequests();
      }
    },

  };
}
