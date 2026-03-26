import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { pipeProcessLogs } from "./process-utils";

export type AutoImproveStatus = "idle" | "running" | "stopping" | "completed" | "failed";

export interface AutoImproveState {
  status: AutoImproveStatus;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  exitCode: number | null;
}

class AutoImproveManager {
  private process: ChildProcess | null = null;
  private state: AutoImproveState = {
    status: "idle",
    startedAt: null,
    finishedAt: null,
    logs: [],
    exitCode: null,
  };

  private getProjectRoot(): string {
    return path.resolve(process.cwd(), "..", "..");
  }

  private getStopFlagPath(): string {
    return path.join(this.getProjectRoot(), ".auto-improve-stop");
  }

  getState(): AutoImproveState {
    return { ...this.state, logs: [...this.state.logs] };
  }

  getStatus(): AutoImproveStatus {
    return this.state.status;
  }

  getLogs(since: number = 0): string[] {
    return this.state.logs.slice(since);
  }

  isRunning(): boolean {
    return this.state.status === "running" || this.state.status === "stopping";
  }

  run(): { success: boolean; error?: string } {
    if (this.isRunning()) {
      return { success: false, error: "Auto-improve is already running" };
    }

    const projectRoot = this.getProjectRoot();
    const scriptPath = path.join(projectRoot, "scripts", "auto-improve.sh");

    // Clean up any leftover stop flag
    this.removeStopFlag();

    // Reset state
    this.state = {
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logs: [],
      exitCode: null,
    };

    this.appendLog(`[auto-improve] Starting auto-improve.sh at ${this.state.startedAt}`);
    this.appendLog(`[auto-improve] Script: ${scriptPath}`);
    this.appendLog(`[auto-improve] CWD: ${projectRoot}`);

    try {
      this.process = spawn("bash", [scriptPath], {
        cwd: projectRoot,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.appendLog(`[auto-improve] Failed to spawn: ${msg}`);
      this.state.status = "failed";
      this.state.finishedAt = new Date().toISOString();
      this.state.exitCode = 1;
      this.process = null;
      return { success: false, error: msg };
    }

    const proc = this.process;

    pipeProcessLogs(proc, (line) => this.appendLog(line));

    proc.on("close", (code: number | null, signal: string | null) => {
      this.state.exitCode = code ?? (signal ? 128 : 1);
      this.state.status = code === 0 ? "completed" : "failed";
      this.state.finishedAt = new Date().toISOString();
      this.appendLog(
        `[auto-improve] Process exited with code ${code} at ${this.state.finishedAt}`
      );
      this.process = null;
      // Clean up stop flag on exit
      this.removeStopFlag();
    });

    proc.on("error", (err: Error) => {
      this.appendLog(`[auto-improve] Process error: ${err.message}`);
      this.state.status = "failed";
      this.state.finishedAt = new Date().toISOString();
      this.process = null;
      this.removeStopFlag();
    });

    return { success: true };
  }

  stop(): { success: boolean; error?: string } {
    if (this.state.status !== "running" || !this.process) {
      return { success: false, error: "Auto-improve is not running" };
    }

    this.appendLog("[auto-improve] Graceful stop requested by user");
    this.state.status = "stopping";

    // Create stop flag file — the shell script checks this and exits gracefully
    try {
      fs.writeFileSync(this.getStopFlagPath(), new Date().toISOString(), "utf-8");
      this.appendLog(`[auto-improve] Stop flag created: ${this.getStopFlagPath()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.appendLog(`[auto-improve] Failed to create stop flag: ${msg}`);
      return { success: false, error: `Failed to create stop flag: ${msg}` };
    }

    return { success: true };
  }

  private removeStopFlag() {
    try {
      const flagPath = this.getStopFlagPath();
      if (fs.existsSync(flagPath)) {
        fs.unlinkSync(flagPath);
      }
    } catch {
      // ignore cleanup errors
    }
  }

  private appendLog(line: string) {
    this.state.logs.push(line);
  }
}

// Singleton — survives Next.js HMR by storing on globalThis
const globalKey = "__autoImproveManager__" as keyof typeof globalThis;
const autoImproveManager: AutoImproveManager =
  (globalThis as Record<string, unknown>)[globalKey] as AutoImproveManager ??
  (() => {
    const m = new AutoImproveManager();
    (globalThis as Record<string, unknown>)[globalKey] = m;
    return m;
  })();
export default autoImproveManager;
