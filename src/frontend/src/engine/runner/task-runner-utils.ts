import { spawn, execSync, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { pipeProcessLogs } from "../../lib/process-utils";
import { getErrorMessage } from "../../lib/error-utils";
import { PROJECT_ROOT, CONFIG_PATH, SIGNALS_DIR } from "../../lib/paths";
import { TaskRunState } from "./task-runner-types";
import { getTask, updateTaskStatus } from "../../service/task-store";

/** config.json에서 workerMode 읽기 */
export function getWorkerMode(): string {
  try {
    const configPath = CONFIG_PATH;
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    return config.workerMode || "background";
  } catch {
    return "background";
  }
}

/** iTerm2 새 탭에서 명령어 실행 */
export function runInIterm(tabTitle: string, cmd: string): boolean {
  try {
    const script = `
tell application "iTerm"
  activate
  tell current window
    set newTab to (create tab with default profile)
    tell current session of newTab
      set name to "${tabTitle}"
      write text "${cmd}"
    end tell
  end tell
end tell`;
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/** 태스크 status를 DB에서 갱신 */
export function updateTaskFileStatus(taskId: string, status: string): void {
  try {
    updateTaskStatus(taskId, status);
  } catch {
    // silently ignore
  }
}

/** DB에서 태스크 role 필드 읽기 */
export function getTaskRole(taskId: string): string {
  try {
    const task = getTask(taskId);
    return task?.role ?? "";
  } catch {
    return "";
  }
}

/** 코드를 수정하지 않는 role은 review 스킵 */
export const SKIP_REVIEW_ROLES = ["tech-writer"];

export function shouldSkipReview(taskId: string): boolean {
  const role = getTaskRole(taskId);
  return SKIP_REVIEW_ROLES.includes(role);
}

/** 해당 태스크의 signal 파일 잔여물 정리 */
export function cleanupSignals(taskId: string): void {
  try {
    if (!fs.existsSync(SIGNALS_DIR)) return;

    const suffixes = [
      "task-done",
      "task-failed",
      "task-rejected",
      "review-approved",
      "review-rejected",
      "stop-request",
      "stopped",
      "start",
    ];
    for (const suffix of suffixes) {
      const f = path.join(SIGNALS_DIR, `${taskId}-${suffix}`);
      try {
        fs.unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  } catch {
    // best-effort
  }
}

/**
 * Spawns a script as a detached process with pipe stdio.
 * Attaches log piping and standard error/close handlers.
 *
 * Returns the ChildProcess on success, or null on spawn failure
 * (after marking state as failed and emitting done).
 */
export function spawnJobProcess(opts: {
  scriptPath: string;
  args: string[];
  taskId: string;
  state: TaskRunState;
  events: EventEmitter;
  label: string;
  env?: Record<string, string | undefined>;
  onClose: (code: number | null) => void;
}): ChildProcess | null {
  const { scriptPath, args, taskId, state, events, label, env, onClose } = opts;

  let proc: ChildProcess;
  try {
    proc = spawn("bash", [scriptPath, ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
  } catch (err) {
    const msg = getErrorMessage(err, String(err));
    state.logs.push(`[task-runner] Failed to spawn ${label}: ${msg}`);
    state.status = "failed";
    state.finishedAt = new Date().toISOString();
    updateTaskFileStatus(taskId, "failed");
    events.emit(`done:${taskId}`, "failed");
    return null;
  }

  pipeProcessLogs(proc, (line) => {
    state.logs.push(line);
    events.emit(`log:${taskId}`, line);
  });

  proc.on("close", onClose);

  proc.on("error", (err: Error) => {
    const errLine = `[task-runner] ${label} process error: ${err.message}`;
    state.logs.push(errLine);
    events.emit(`log:${taskId}`, errLine);
    state.status = "failed";
    state.finishedAt = new Date().toISOString();
    updateTaskFileStatus(taskId, "failed");
    events.emit(`done:${taskId}`, "failed");
  });

  return proc;
}

/** iTerm에서 실행 중인 task 프로세스를 찾아서 kill */
export function killItermTask(taskId: string): void {
  try {
    // claude 워커 또는 tsx review 프로세스 찾기
    const pids = execSync(
      `pgrep -f "claude.*${taskId}" 2>/dev/null || pgrep -f "run-review\\.ts ${taskId}" 2>/dev/null || true`,
      { encoding: "utf-8" },
    ).trim();

    if (pids) {
      for (const pid of pids.split("\n")) {
        const p = pid.trim();
        if (p) {
          try {
            process.kill(-parseInt(p, 10), "SIGTERM");
          } catch {
            try {
              process.kill(parseInt(p, 10), "SIGTERM");
            } catch {
              /* already dead */
            }
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
}
