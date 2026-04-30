import { z } from "zod";
import type { OrchestrationStatusData } from "@/orchestrate/orchestration-manager";
import { formatStructuredLogLine, type StructuredLogEntry } from "@/bus/logging/log-format";
import nightWorkerManager from "@/orchestrate/night-worker";
import { getLatestEvent, getRecentEvents } from "../bus/bus";
import { registerRpc } from "../rpc/registry";

function toOrchestrateLogLine(data: unknown): string | null {
  const payload = data as {
    scope?: string;
    entry?: StructuredLogEntry;
    line?: string;
  };

  if (payload?.scope !== "orchestrate") {
    return null;
  }

  if (payload.entry) {
    return formatStructuredLogLine(payload.entry);
  }

  return typeof payload.line === "string" ? payload.line : null;
}

registerRpc({
  name: "orchestrate.status",
  idempotent: true,
  paramsSchema: z.object({}).strict(),
  handler: async () => {
    const latest = getLatestEvent("orchestration.status");
    return (latest?.data as OrchestrationStatusData | undefined) ?? null;
  },
});

registerRpc({
  name: "orchestrate.logs",
  idempotent: true,
  paramsSchema: z.object({
    limit: z.number().int().positive().max(1000).optional(),
  }).strict(),
  handler: async ({ limit }) => {
    const logs = getRecentEvents("log.dashboard", limit ?? 200)
      .map((env) => toOrchestrateLogLine(env.data))
      .filter((line): line is string => typeof line === "string");
    return { logs, total: logs.length };
  },
});

registerRpc({
  name: "night-worker.status",
  idempotent: true,
  paramsSchema: z.object({}).strict(),
  handler: async () => nightWorkerManager.getState(),
});

registerRpc({
  name: "night-worker.run",
  idempotent: false,
  paramsSchema: z.object({
    until: z.string().optional(),
    budget: z.number().nullable().optional(),
    maxTasks: z.number().int().positive().optional(),
    types: z.string().optional(),
    instructions: z.string().optional(),
  }).strict(),
  handler: async ({ until, budget, maxTasks, types, instructions }) => {
    const result = nightWorkerManager.run({
      until,
      budget: budget ?? null,
      maxTasks,
      types,
      instructions,
    });

    if (!result.success) {
      throw {
        code: "ALREADY_RUNNING",
        message: result.error ?? "night worker run failed",
      };
    }

    const state = nightWorkerManager.getState();
    return {
      message: "Night Worker 시작됨",
      pid: state.pid,
      until: state.until,
      budget: state.budget ?? "unlimited",
      maxTasks: state.maxTasks,
      types: state.types,
    };
  },
});

registerRpc({
  name: "night-worker.stop",
  idempotent: true,
  paramsSchema: z.object({}).strict(),
  handler: async () => {
    const result = nightWorkerManager.stop();
    if (!result.success) {
      throw {
        code: "NOT_RUNNING",
        message: "실행 중인 Night Worker가 없습니다.",
      };
    }

    return { message: "Night Worker 중지됨" };
  },
});
