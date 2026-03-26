import { spawn, ChildProcess, execSync } from "child_process";
import path from "path";
import fs from "fs";
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

  constructor() {
    this.cleanupZombies();
  }

  /** 서버 시작 시 좀비 in_progress 태스크 정리 */
  private cleanupZombies() {
    try {
      const projectRoot = path.resolve(process.cwd(), "..", "..");
      const tasksDir = path.join(projectRoot, ".orchestration", "tasks");
      if (!fs.existsSync(tasksDir)) return;

      const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith(".md"));
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(tasksDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        if (!content.includes("status: in_progress")) continue;

        // PID 파일 체크: 워커가 실제로 살아있는지
        const idMatch = file.match(/^(TASK-\d+)/);
        if (!idMatch) continue;
        const taskId = idMatch[1];
        const pidFile = `/tmp/worker-${taskId}.pid`;

        let alive = false;
        if (fs.existsSync(pidFile)) {
          try {
            const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
            if (!isNaN(pid)) {
              execSync(`kill -0 ${pid}`, { stdio: "ignore" });
              alive = true;
            }
          } catch {
            // 프로세스 죽음
            try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
          }
        }

        if (!alive) {
          const updated = content.replace("status: in_progress", "status: stopped");
          fs.writeFileSync(filePath, updated);
          cleaned++;
          console.log(`[orchestrate] zombie cleanup: ${taskId} in_progress → stopped`);
        }
      }

      if (cleaned > 0) {
        console.log(`[orchestrate] ${cleaned}개 좀비 태스크 정리 완료`);
      }

      // stale lock 정리
      const lockDir = "/tmp/orchestrate.lock";
      if (fs.existsSync(lockDir)) {
        const pidFile = path.join(lockDir, "pid");
        if (fs.existsSync(pidFile)) {
          try {
            const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
            execSync(`kill -0 ${pid}`, { stdio: "ignore" });
            // 살아있으면 건드리지 않음
          } catch {
            // 죽어있으면 lock 제거
            fs.rmSync(lockDir, { recursive: true, force: true });
            console.log("[orchestrate] stale lock 제거");
          }
        }
      }
    } catch (err) {
      console.warn("[orchestrate] zombie cleanup error:", err);
    }
  }

  getState(): OrchestrationState {
    this.getStatus(); // status 동기화
    return { ...this.state, logs: [...this.state.logs], taskResults: [...this.state.taskResults] };
  }

  getStatus(): OrchestrationStatus {
    // process 객체가 있는데 실제로 죽어있으면 즉시 갱신
    if (this.state.status === "running" && this.process) {
      if (this.process.exitCode !== null || this.process.killed) {
        this.state.status = "failed";
        this.state.finishedAt = new Date().toISOString();
        this.process = null;
      }
    }
    // process 없는데 running이면 보정
    if (this.state.status === "running" && !this.process && !this.launching) {
      this.state.status = "failed";
      this.state.finishedAt = new Date().toISOString();
    }
    return this.state.status;
  }

  getLogs(since: number = 0): string[] {
    return this.state.logs.slice(since);
  }

  isRunning(): boolean {
    return this.getStatus() === "running";
  }

  private launching = false;

  run(): { success: boolean; error?: string } {
    if (this.isRunning() || this.launching) {
      return { success: false, error: "Orchestration is already running" };
    }

    // pgrep 이중 체크: process 객체 외에 실제 프로세스도 확인
    try {
      const existing = execSync('pgrep -f "orchestrate.sh" 2>/dev/null || true', { encoding: "utf-8" }).trim();
      if (existing) {
        return { success: false, error: "orchestrate.sh가 이미 실행 중입니다" };
      }
    } catch { /* ignore */ }

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
    this.appendLog("[orchestrate] Stop requested by user — 즉시 전체 종료");

    // 1) orchestrate.sh kill
    if (this.process) {
      killProcessGracefully(this.process);
    }
    // pgrep으로 놓친 인스턴스도 kill
    try { execSync('pkill -f "orchestrate.sh" 2>/dev/null || true', { stdio: "ignore" }); } catch { /* ignore */ }

    // 2) 모든 워커 kill
    try { execSync('pkill -f "job-task.sh" 2>/dev/null || true', { stdio: "ignore" }); } catch { /* ignore */ }
    try { execSync('pkill -f "job-review.sh" 2>/dev/null || true', { stdio: "ignore" }); } catch { /* ignore */ }
    try { execSync('pkill -f "claude.*--dangerously-skip-permissions" 2>/dev/null || true', { stdio: "ignore" }); } catch { /* ignore */ }

    // 3) in_progress → stopped
    this.markAllInProgressAsStopped();

    // 4) lock/signal/PID 정리
    try { execSync('rm -rf /tmp/orchestrate.lock /tmp/orchestrate-retry /tmp/worker-TASK-*.pid 2>/dev/null || true', { stdio: "ignore" }); } catch { /* ignore */ }

    // 5) status 즉시 반영
    this.state.status = "failed";
    this.state.exitCode = 130; // SIGINT convention
    this.state.finishedAt = new Date().toISOString();
    this.process = null;
    this.saveRunHistory();

    this.appendLog("[orchestrate] 전체 종료 완료");

    return { success: true };
  }

  /** in_progress 태스크를 모두 stopped로 변경 */
  private markAllInProgressAsStopped() {
    try {
      const projectRoot = path.resolve(process.cwd(), "..", "..");
      const tasksDir = path.join(projectRoot, ".orchestration", "tasks");
      if (!fs.existsSync(tasksDir)) return;

      const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const filePath = path.join(tasksDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.includes("status: in_progress")) {
          fs.writeFileSync(filePath, content.replace("status: in_progress", "status: stopped"));
          const idMatch = file.match(/^(TASK-\d+)/);
          if (idMatch) {
            this.appendLog(`[orchestrate] ${idMatch[1]}: in_progress → stopped`);
          }
        }
      }
    } catch (err) {
      this.appendLog(`[orchestrate] markAllInProgressAsStopped error: ${err}`);
    }
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
