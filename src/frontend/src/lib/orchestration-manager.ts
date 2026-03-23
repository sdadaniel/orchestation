import { spawn, ChildProcess } from "child_process";
import path from "path";

export type OrchestrationStatus = "idle" | "running" | "completed" | "failed";

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

  run(): { success: boolean; error?: string } {
    if (this.isRunning()) {
      return { success: false, error: "Orchestration is already running" };
    }

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

    try {
      this.process = spawn("bash", [scriptPath], {
        cwd: projectRoot,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.appendLog(`[orchestrate] Failed to spawn: ${msg}`);
      this.state.status = "failed";
      this.state.finishedAt = new Date().toISOString();
      this.state.exitCode = 1;
      this.process = null;
      return { success: false, error: msg };
    }

    const proc = this.process;

    proc.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString("utf-8").split("\n");
      for (const line of lines) {
        if (line.trim()) {
          this.appendLog(line);
          this.parseTaskResult(line);
        }
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString("utf-8").split("\n");
      for (const line of lines) {
        if (line.trim()) {
          this.appendLog(`[stderr] ${line}`);
        }
      }
    });

    proc.on("close", (code: number | null, signal: string | null) => {
      this.state.exitCode = code ?? (signal ? 128 : 1);
      this.state.status = code === 0 ? "completed" : "failed";
      this.state.finishedAt = new Date().toISOString();
      this.appendLog(
        `[orchestrate] Process exited with code ${code} at ${this.state.finishedAt}`
      );
      this.process = null;
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

    // Kill the process group
    try {
      // Attempt to kill the entire process group
      if (this.process.pid) {
        process.kill(-this.process.pid, "SIGTERM");
      } else {
        this.process.kill("SIGTERM");
      }
    } catch {
      // Fallback: kill just the process
      try {
        this.process.kill("SIGTERM");
      } catch {
        // Process may have already exited
      }
    }

    // If process doesn't exit in 5s, force kill
    const proc = this.process;
    setTimeout(() => {
      if (proc && !proc.killed) {
        try {
          proc.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
    }, 5000);

    return { success: true };
  }

  private appendLog(line: string) {
    this.state.logs.push(line);
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

// Singleton — keeps state across API calls within the same server process
const orchestrationManager = new OrchestrationManager();
export default orchestrationManager;
