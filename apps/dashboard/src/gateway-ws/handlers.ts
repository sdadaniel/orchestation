"use client";

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { useTasksStore } from "@/store/tasksStore";
import type { OrchestrationStatusData } from "@/gateway/orchestration-manager";

export function createEventHandlers(queryClient: QueryClient) {
  const invalidateTasksAndRequests = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
  };

  return {
    onEvent(event: string, data: unknown, _seq: number) {
      if (event === "task-changed") {
        const d = data as { full?: boolean; deleted?: boolean; taskId?: string; status?: string; priority?: string; title?: string };
        if (d.full || d.deleted) {
          invalidateTasksAndRequests();
          useTasksStore.getState().fetchAll();
          return;
        }
        if (d.taskId) {
          const patch: Record<string, string> = {};
          if (d.status) patch.status = d.status;
          if (d.priority) patch.priority = d.priority;
          if (d.title) patch.title = d.title;
          const store = useTasksStore.getState();
          const exists = store.requests.some((r) => r.id === d.taskId);
          if (exists) store.patchRequest(d.taskId, patch);
          else store.fetchAll();
          invalidateTasksAndRequests();
        }
        return;
      }

      if (event === "orchestration-status") {
        const statusData = data as OrchestrationStatusData;
        const store = useOrchestrationStore.getState();
        const prevStatus = store.data.status;
        const justFinished =
          prevStatus === "running" &&
          (statusData.status === "completed" ||
            statusData.status === "failed" ||
            statusData.status === "idle");

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
        return;
      }
    },

    onSnapshot(snapshot: unknown) {
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
      }
      if (s.tasksFullHint) {
        useTasksStore.getState().fetchAll();
        invalidateTasksAndRequests();
      }
    },

    onReplayGap() {
      invalidateTasksAndRequests();
      useTasksStore.getState().fetchAll();
    },
  };
}
