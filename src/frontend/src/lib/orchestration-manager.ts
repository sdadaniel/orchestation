import { spawn, ChildProcess } from "child_process";
import path from "path";
import { appendRunHistory, type RunHistoryEntry } from "./run-history";
import { parseCostLog } from "./cost-parser";
import { loadSettings } from "./settings";
import { pipeProcessLogs, killProcessGracefully } from "./process-utils";

export type OrchestrationStatus = "idle" | "running" | "completed" | "failed";

export interface OrchestrationStatusData {
  status: OrchestrationStatus;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  taskResults: { taskId: string; status: "success" | "failure" }[];
}

export interface TaskResult {
  taskId: string;
  status: "success" | "failure";
}

export interface OrchestrationState {
  status: OrchestrationStatus;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  taskResults: TaskResult[];
  exitCode: number | null;
}

class OrchestrationManager {
  private process: ChildProcess | null = null;
  private state: OrchestrationState = {
    status: "idle",
    startedAt: null,
    finishedAt: null,
    logs: [],
    taskResults: [],
    exitCode: null,
  };

  getState(): OrchestrationState {
    return { ...this.state, logs: [...this.state.logs], taskResults: [...this.state.taskResults] };
  }

  getStatus(): OrchestrationStatus {
    return this.state.status;
  }

  getLogs(since: number = 0): string[] {
    return this.state.logs.slice(since);
  }

  isRunning(): boolean {
    return this.state.status === "running";
  }

  private launching = false;

  run(): { success: boolean; error?: string } {
    if (this.isRunning() || this.launching) {
      return { success: false, error: "Orchestration is already running" };
    }
    this.launching = true;

    // Resolve orchestrate.sh path relative to project root
    // The frontend is at src/frontend, so project root is ../../
    const projectRoot = path.resolve(process.cwd(), "..", "..");
    const scriptPath = path.join(projectRoot, "scripts", "orchestrate.sh");

    // Reset state
    this.state = {
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logs: [],
      taskResults: [],
      exitCode: null,
    };

    this.appendLog(`[orchestrate] Starting orchestrate.sh at ${this.state.startedAt}`);
    this.appendLog(`[orchestrate] Script: ${scriptPath}`);
    this.appendLog(`[orchestrate] CWD: ${projectRoot}`);

    const settings = loadSettings();

    try {
      this.process = spawn("bash", [scriptPath], {
        cwd: projectRoot,
        env: {
          ...process.env,
          MAX_PARALLEL: String(settings.maxParallel),
          BASE_BRANCH: settings.baseBranch,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.appendLog(`[orchestrate] Failed to spawn: ${msg}`);
      this.state.status = "failed";
      this.state.finishedAt = new Date().toISOString();
      this.state.exitCode = 1;
      this.process = null;
      this.launching = false;
      return { success: false, error: msg };
    }

    this.launching = false;
    const proc = this.process;

    pipeProcessLogs(proc, (line) => this.appendLog(line), (line) => this.parseTaskResult(line));

    proc.on("close", (code: number | null, signal: string | null) => {
      this.state.exitCode = code ?? (signal ? 128 : 1);
      this.state.status = code === 0 ? "completed" : "failed";
      this.state.finishedAt = new Date().toISOString();
      this.appendLog(
        `[orchestrate] Process exited with code ${code} at ${this.state.finishedAt}`
      );
      this.process = null;
      this.saveRunHistory();
    });

    proc.on("error", (err: Error) => {
      this.appendLog(`[orchestrate] Process error: ${err.message}`);
      this.state.status = "failed";
      this.state.finishedAt = new Date().toISOString();
      this.process = null;
    });

    return { success: true };
  }

  stop(): { success: boolean; error?: string } {
    if (!this.isRunning() || !this.process) {
      return { success: false, error: "No orchestration is running" };
    }

    this.appendLog("[orchestrate] Stop requested by user");

    killProcessGracefully(this.process);

    return { success: true };
  }

  private appendLog(line: string) {
    this.state.logs.push(line);
  }

  /**
   * Save completed run to output/run-history.json
   */
  private saveRunHistory() {
    try {
      if (!this.state.startedAt || !this.state.finishedAt) return;

      const startTime = new Date(this.state.startedAt).getTime();
      const endTime = new Date(this.state.finishedAt).getTime();
      const durationMs = endTime - startTime;

      // Calculate cost from token-usage.log entries that fall within this run
      let totalCostUsd = 0;
      try {
        const costData = parseCostLog();
        for (const entry of costData.entries) {
          const entryTime = new Date(entry.timestamp.replace(" ", "T")).getTime();
          if (entryTime >= startTime && entryTime <= endTime) {
            totalCostUsd += entry.costUsd;
          }
        }
      } catch {
        // cost log may not exist
      }

      const tasksCompleted = this.state.taskResults.filter(
        (r) => r.status === "success"
      ).length;
      const tasksFailed = this.state.taskResults.filter(
        (r) => r.status === "failure"
      ).length;

      const entry: RunHistoryEntry = {
        id: `run-${this.state.startedAt.replace(/[^0-9]/g, "").slice(0, 14)}`,
        startedAt: this.state.startedAt,
        finishedAt: this.state.finishedAt,
        status: this.state.status as "completed" | "failed",
        exitCode: this.state.exitCode,
        taskResults: [...this.state.taskResults],
        totalCostUsd: parseFloat(totalCostUsd.toFixed(6)),
        totalDurationMs: durationMs,
        tasksCompleted,
        tasksFailed,
      };

      appendRunHistory(entry);
      this.appendLog(
        `[orchestrate] Run history saved: ${entry.id} (${tasksCompleted} completed, ${tasksFailed} failed, $${totalCostUsd.toFixed(4)})`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.appendLog(`[orchestrate] Failed to save run history: ${msg}`);
    }
  }

  /**
   * Parse task results from orchestrate.sh output.
   * Looks for patterns like:
   *   ✅ TASK-001 completed
   *   ❌ TASK-002 failed
   */
  private parseTaskResult(line: string) {
    const successMatch = line.match(/[✅✓]\s*(TASK-\d+)/);
    if (successMatch) {
      this.state.taskResults.push({
        taskId: successMatch[1],
        status: "success",
      });
      return;
    }

    const failMatch = line.match(/[❌✗✘]\s*(TASK-\d+)/);
    if (failMatch) {
      this.state.taskResults.push({
        taskId: failMatch[1],
        status: "failure",
      });
    }
  }
}

// Singleton — survives Next.js HMR by storing on globalThis
const globalKey = "__orchestrationManager__" as keyof typeof globalThis;
const orchestrationManager: OrchestrationManager =
  (globalThis as Record<string, unknown>)[globalKey] as OrchestrationManager ??
  (() => {
    const m = new OrchestrationManager();
    (globalThis as Record<string, unknown>)[globalKey] = m;
    return m;
  })();
export default orchestrationManager;
