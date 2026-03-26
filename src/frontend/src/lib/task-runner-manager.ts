import { spawn, ChildProcess } from "child_process";
import path from "path";
import { pipeProcessLogs, killProcessGracefully } from "./process-utils";
import { getErrorMessage } from "./error-utils";

export type TaskRunStatus = "idle" | "running" | "completed" | "failed";

export interface TaskRunState {
  taskId: string;
  status: TaskRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  exitCode: number | null;
}

class TaskRunnerManager {
  /** Currently running tasks keyed by task ID */
  private runs: Map<string, { state: TaskRunState; process: ChildProcess }> =
    new Map();

  private getProjectRoot(): string {
    return path.resolve(process.cwd(), "..", "..");
  }

  getState(taskId: string): TaskRunState | null {
    const run = this.runs.get(taskId);
    return run
      ? { ...run.state, logs: [...run.state.logs] }
      : null;
  }

  isRunning(taskId: string): boolean {
    return this.runs.get(taskId)?.state.status === "running";
  }

  /** Returns all task IDs that are currently running */
  getRunningIds(): string[] {
    const ids: string[] = [];
    for (const [id, run] of this.runs) {
      if (run.state.status === "running") ids.push(id);
    }
    return ids;
  }

  run(taskId: string): { success: boolean; error?: string } {
    if (this.isRunning(taskId)) {
      return { success: false, error: `Task ${taskId} is already running` };
    }

    const projectRoot = this.getProjectRoot();
    const scriptPath = path.join(projectRoot, "scripts", "job-task.sh");

    const state: TaskRunState = {
      taskId,
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logs: [],
      exitCode: null,
    };

    state.logs.push(`[task-runner] Starting ${taskId} at ${state.startedAt}`);

    let proc: ChildProcess;
    try {
      proc = spawn("bash", [scriptPath, taskId], {
        cwd: projectRoot,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });
    } catch (err) {
      const msg = getErrorMessage(err, String(err));
      state.logs.push(`[task-runner] Failed to spawn: ${msg}`);
      state.status = "failed";
      state.finishedAt = new Date().toISOString();
      state.exitCode = 1;
      return { success: false, error: msg };
    }

    this.runs.set(taskId, { state, process: proc });

    pipeProcessLogs(proc, (line) => state.logs.push(line));

    proc.on("close", (code: number | null) => {
      state.exitCode = code ?? 1;
      state.status = code === 0 ? "completed" : "failed";
      state.finishedAt = new Date().toISOString();
      state.logs.push(
        `[task-runner] ${taskId} exited with code ${code} at ${state.finishedAt}`
      );
    });

    proc.on("error", (err: Error) => {
      state.logs.push(`[task-runner] Process error: ${err.message}`);
      state.status = "failed";
      state.finishedAt = new Date().toISOString();
    });

    return { success: true };
  }

  stop(taskId: string): { success: boolean; error?: string } {
    const run = this.runs.get(taskId);
    if (!run || run.state.status !== "running") {
      return { success: false, error: `Task ${taskId} is not running` };
    }

    run.state.logs.push(`[task-runner] Stop requested for ${taskId}`);

    killProcessGracefully(run.process);

    return { success: true };
  }
}

const taskRunnerManager = new TaskRunnerManager();
export default taskRunnerManager;
