import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { z } from "zod";
import taskRunnerManager from "@/orchestrate/runner/task-runner-manager";
import orchestrationManager from "@/orchestrate/orchestration-manager";
import type { TaskStatus } from "@/entities/task";
import { parseDependsOn } from "@/lib/task-row-parsers";
import { PROJECT_ROOT, OUTPUT_DIR } from "@/lib/config/paths";
import {
  getTask,
  getAllTasks,
  updateTaskStatus,
} from "@/service/task-store";
import { registerRpc } from "../registry";

const SIGNAL_DIR = path.join(PROJECT_ROOT, ".orchestration", "signals");
const TASK_ID_PATTERN = /^TASK-\d{3}$/;

function isValidTaskId(id: string): boolean {
  return TASK_ID_PATTERN.test(id);
}

function markTaskAsStopped(taskId: string): void {
  const task = getTask(taskId);
  if (!task) return;
  updateTaskStatus(taskId, "stopped", task.status as TaskStatus);
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

    if (orchestrationManager.isRunning()) {
      throw {
        code: "ALREADY_RUNNING",
        message: "파이프라인 실행 중입니다. 중지 후 다시 시도하세요.",
      };
    }

    const taskRow = getTask(taskId);
    if (taskRow) {
      const dependsOnIds = parseDependsOn(taskRow);
      if (dependsOnIds.length > 0) {
        const allTasks = getAllTasks();
        const unmetDeps = dependsOnIds.filter((depId) => {
          const dep = allTasks.find((task) => task.id === depId);
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

    for (const filePath of [
      path.join(OUTPUT_DIR, `${taskId}-task.json`),
      path.join(OUTPUT_DIR, `${taskId}-task-conversation.jsonl`),
      path.join(OUTPUT_DIR, `${taskId}-rejection-reason.txt`),
    ]) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }

    const result = taskRunnerManager.run(taskId);
    if (!result.success) {
      throw {
        code: "ALREADY_RUNNING",
        message: result.error ?? `Task ${taskId} is already running`,
      };
    }

    return {
      message: `Task ${taskId} started`,
      taskId,
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

    const state = taskRunnerManager.getState(taskId);
    if (!state) {
      return {
        status: "idle",
        taskId,
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

    createStopRequest(taskId);
    const result = taskRunnerManager.stop(taskId);

    if (!result.success) {
      try {
        const pids = execSync(`pgrep -f "claude.*${taskId}" 2>/dev/null || true`, {
          encoding: "utf-8",
        }).trim();

        if (!pids) {
          markTaskAsStopped(taskId);
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
        markTaskAsStopped(taskId);
        throw {
          code: "STOP_FAILED",
          message: `${taskId} 중지 실패`,
        };
      }
    }

    markTaskAsStopped(taskId);
    return {
      message: `Task ${taskId} stopped`,
      status: "stopped",
    };
  },
});
