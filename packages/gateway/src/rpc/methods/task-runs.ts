import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { z } from "zod";
import taskRunnerManager from "@/orchestrate/runner/task-runner-manager";
import orchestrationManager from "@/orchestrate/orchestration-manager";
import type { TaskStatus } from "@/entities/task";
import { parseDependsOn } from "@/lib/task-row-parsers";
import { PROJECT_ROOT, OUTPUT_DIR } from "@/lib/config/paths";
import { loadSettings } from "@/lib/config/settings";
import {
  getTask,
  getAllTasks,
  updateTaskStatus,
  getTaskDisplayId,
  getTaskLookupKeys,
  resolveTaskId,
  resolveTaskRef,
} from "@/service/task-store";
import { retryTask } from "@/orchestrate/core/task-transitions";
import { registerRpc } from "../registry";

const SIGNAL_DIR = path.join(PROJECT_ROOT, ".orchestration", "signals");
const TASK_ID_PATTERN = /^[A-Za-z0-9][\w-]*$/;

function isValidTaskId(id: string): boolean {
  return TASK_ID_PATTERN.test(id);
}

function markTaskAsStopped(taskId: string): void {
  const task = getTask(taskId);
  if (!task) return;
  updateTaskStatus(task.id, "stopped", task.status as TaskStatus);
}

function createStopRequest(taskId: string): void {
  try {
    fs.mkdirSync(SIGNAL_DIR, { recursive: true });
    const target = path.join(SIGNAL_DIR, `${taskId}-stop-request`);
    const tmp = `${target}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, String(process.pid));
    fs.renameSync(tmp, target);
  } catch {
    /* ignore */
  }
}

registerRpc({
  name: "task.run",
  idempotent: false,
  paramsSchema: z.object({ taskId: z.string().min(1) }).strict(),
  handler: async ({ taskId }) => {
    if (!isValidTaskId(taskId)) {
      throw { code: "INVALID_PARAMS", message: "Invalid task ID format" };
    }
    const resolved = resolveTaskRef(taskId);
    if (!resolved) {
      throw { code: "NOT_FOUND", message: "Task not found" };
    }
    const canonicalTaskId = resolved.task.id;
    const displayTaskId = getTaskDisplayId(resolved.task);

    if (orchestrationManager.isRunning()) {
      throw {
        code: "ALREADY_RUNNING",
        message: "파이프라인 실행 중입니다. 중지 후 다시 시도하세요.",
      };
    }

    const taskRow = resolved.task;
    if (taskRow) {
      const dependsOnIds = parseDependsOn(taskRow);
      if (dependsOnIds.length > 0) {
        const allTasks = getAllTasks();
        const unmetDeps = dependsOnIds.filter((depId) => {
          const dep = allTasks.find(
            (task) => task.id === depId || task.display_id === depId,
          );
          return !dep || dep.status !== "done";
        });
        if (unmetDeps.length > 0) {
          throw {
            code: "UNMET_DEPENDENCIES",
            message: `의존성 미충족: ${unmetDeps.join(", ")}이(가) 아직 완료되지 않았습니다.`,
          };
        }
      }
    }

    for (const taskKey of getTaskLookupKeys(taskRow)) {
      for (const filePath of [
        path.join(OUTPUT_DIR, `${taskKey}-task.json`),
        path.join(OUTPUT_DIR, `${taskKey}-task-conversation.jsonl`),
        path.join(OUTPUT_DIR, `${taskKey}-rejection-reason.txt`),
      ]) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
      }
    }

    const result = taskRunnerManager.run(canonicalTaskId);
    if (!result.success) {
      throw {
        code: "ALREADY_RUNNING",
        message: result.error ?? `Task ${displayTaskId} is already running`,
      };
    }

    return {
      message: `Task ${displayTaskId} started`,
      taskId: canonicalTaskId,
    };
  },
});

registerRpc({
  name: "task.retry",
  idempotent: false,
  paramsSchema: z.object({ taskId: z.string().min(1) }).strict(),
  handler: async ({ taskId }) => {
    if (!isValidTaskId(taskId)) {
      throw { code: "INVALID_PARAMS", message: "Invalid task ID format" };
    }
    const resolved = resolveTaskRef(taskId);
    if (!resolved) {
      throw { code: "NOT_FOUND", message: "Task not found" };
    }

    const task = resolved.task;
    const canonicalTaskId = task.id;
    const displayTaskId = getTaskDisplayId(task);

    if (task.status === "in_progress" || task.status === "reviewing") {
      throw {
        code: "TASK_ACTIVE",
        message: "실행 중인 태스크는 먼저 Stop 하세요.",
      };
    }

    if (!["failed", "rejected", "stopped"].includes(task.status)) {
      throw {
        code: "INVALID_STATE",
        message: "Retry는 failed, rejected, stopped 상태에서만 가능합니다.",
      };
    }

    const dependsOnIds = parseDependsOn(task);
    if (dependsOnIds.length > 0) {
      const allTasks = getAllTasks();
      const unmetDeps = dependsOnIds.filter((depId) => {
        const dep = allTasks.find(
          (candidate) => candidate.id === depId || candidate.display_id === depId,
        );
        return !dep || dep.status !== "done";
      });
      if (unmetDeps.length > 0) {
        throw {
          code: "UNMET_DEPENDENCIES",
          message: `의존성 미충족: ${unmetDeps.join(", ")}이(가) 아직 완료되지 않았습니다.`,
        };
      }
    }

    const settings = loadSettings();
    const result = retryTask(canonicalTaskId, {
      log: () => {},
      startStep: () => false,
      emitTaskResult: () => {},
      maxReviewRetry: () => settings.maxReviewRetry,
      baseBranch: () => settings.baseBranch,
    });

    return {
      message: `Task ${displayTaskId} retried`,
      taskId: canonicalTaskId,
      reactivatedDependentIds: result.reactivatedDependentIds,
      resetStepCount: result.resetStepCount,
    };
  },
});

registerRpc({
  name: "task.status",
  idempotent: true,
  paramsSchema: z.object({ taskId: z.string().min(1) }).strict(),
  handler: async ({ taskId }) => {
    if (!isValidTaskId(taskId)) {
      throw { code: "INVALID_PARAMS", message: "Invalid task ID format" };
    }
    const canonicalTaskId = resolveTaskId(taskId);
    if (!canonicalTaskId) {
      return {
        status: "idle",
        taskId,
        logs: [],
      };
    }

    const state = taskRunnerManager.getState(canonicalTaskId);
    if (!state) {
      return {
        status: "idle",
        taskId: canonicalTaskId,
        logs: [],
      };
    }

    return state;
  },
});

registerRpc({
  name: "task.stop",
  idempotent: true,
  paramsSchema: z.object({ taskId: z.string().min(1) }).strict(),
  handler: async ({ taskId }) => {
    if (!isValidTaskId(taskId)) {
      throw { code: "INVALID_PARAMS", message: "Invalid task ID format" };
    }
    const canonicalTaskId = resolveTaskId(taskId);
    if (!canonicalTaskId) {
      throw { code: "NOT_FOUND", message: "Task not found" };
    }

    createStopRequest(canonicalTaskId);
    const result = taskRunnerManager.stop(canonicalTaskId);

    if (!result.success) {
      try {
        const pids = execSync(`pgrep -f "claude.*${canonicalTaskId}" 2>/dev/null || true`, {
          encoding: "utf-8",
        }).trim();

        if (!pids) {
          markTaskAsStopped(canonicalTaskId);
          throw {
            code: "NOT_RUNNING",
            message: `${taskId}에 대한 실행 중인 프로세스를 찾을 수 없습니다.`,
          };
        }

        for (const pid of pids.split("\n")) {
          const trimmedPid = pid.trim();
          if (!trimmedPid) continue;
          try {
            process.kill(-parseInt(trimmedPid, 10), "SIGTERM");
          } catch {
            try {
              process.kill(parseInt(trimmedPid, 10), "SIGTERM");
            } catch {
              /* ignore */
            }
          }
        }
      } catch (err) {
        if ((err as { code?: string }).code === "NOT_RUNNING") {
          throw err;
        }
        markTaskAsStopped(canonicalTaskId);
        throw {
          code: "STOP_FAILED",
          message: `${taskId} 중지 실패`,
        };
      }
    }

    markTaskAsStopped(canonicalTaskId);
    return {
      message: `Task ${taskId} stopped`,
      status: "stopped",
    };
  },
});
