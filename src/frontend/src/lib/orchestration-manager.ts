import { EventEmitter } from "events";
import { OrchestrateEngine, EngineStatus } from "./orchestrate-engine";
import { appendRunHistory, type RunHistoryEntry } from "./run-history";
import { parseCostLog } from "./cost-parser";
import { getErrorMessage } from "./error-utils";

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
  private engine: OrchestrateEngine | null = null;

  /** SSE 클라이언트에게 상태 변경을 알리기 위한 이벤트 버스 */
  public readonly events = new EventEmitter();

  private state: OrchestrationState = {
    status: "idle",
    startedAt: null,
    finishedAt: null,
    logs: [],
    taskResults: [],
    exitCode: null,
  };

  constructor() {
    this.events.setMaxListeners(50);
  }

  /** 상태 변경 시 SSE 클라이언트에 알림 */
  private emitStatusChange() {
    const state = this.getState();
    this.events.emit("status-changed", {
      status: state.status,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      exitCode: state.exitCode,
      taskResults: state.taskResults,
    });
  }

  // ── Public API ─────────────────────────────────────────

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

  // ── Run ────────────────────────────────────────────────

  run(): { success: boolean; error?: string } {
    if (this.isRunning()) {
      return { success: false, error: "Orchestration is already running" };
    }

    // 상태 리셋
    this.state = {
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logs: [],
      taskResults: [],
      exitCode: null,
    };

    this.appendLog("[orchestrate] Starting Node.js engine");
    this.emitStatusChange();

    // 엔진 생성 및 이벤트 연결
    this.engine = new OrchestrateEngine();

    this.engine.on("log", (line: string) => {
      this.appendLog(line);
    });

    this.engine.on("status-changed", (status: EngineStatus) => {
      if (status === "idle" || status === "completed" || status === "failed") {
        this.state.status = status === "idle" ? "completed" : status;
        this.state.finishedAt = new Date().toISOString();
        this.state.exitCode = status === "completed" ? 0 : 1;
        this.saveRunHistory();
        this.emitStatusChange();
      }
    });

    this.engine.on("task-result", (result: { taskId: string; status: "success" | "failure" }) => {
      this.state.taskResults.push(result);
      this.emitStatusChange();
    });

    const result = this.engine.start();
    if (!result.success) {
      this.state.status = "failed";
      this.state.finishedAt = new Date().toISOString();
      this.state.exitCode = 1;
      this.appendLog(`[orchestrate] Engine start failed: ${result.error}`);
      this.emitStatusChange();
    }

    return result;
  }

  // ── Stop ───────────────────────────────────────────────

  stop(): { success: boolean; error?: string } {
    this.appendLog("[orchestrate] Stop requested");

    if (this.engine) {
      this.engine.stop();
      this.engine.removeAllListeners();
      this.engine = null;
    }

    this.state.status = "failed";
    this.state.exitCode = 130;
    this.state.finishedAt = new Date().toISOString();
    this.saveRunHistory();

    this.appendLog("[orchestrate] 전체 종료 완료");
    this.emitStatusChange();
    return { success: true };
  }

  // ── Internal ───────────────────────────────────────────

  private appendLog(line: string) {
    this.state.logs.push(line);
  }

  private saveRunHistory() {
    try {
      if (!this.state.startedAt || !this.state.finishedAt) return;

      const startTime = new Date(this.state.startedAt).getTime();
      const endTime = new Date(this.state.finishedAt).getTime();
      const durationMs = endTime - startTime;

      let totalCostUsd = 0;
      try {
        const costData = parseCostLog();
        for (const entry of costData.entries) {
          const entryTime = new Date(entry.timestamp.replace(" ", "T")).getTime();
          if (entryTime >= startTime && entryTime <= endTime) {
            totalCostUsd += entry.costUsd;
          }
        }
      } catch { /* ignore */ }

      const tasksCompleted = this.state.taskResults.filter((r) => r.status === "success").length;
      const tasksFailed = this.state.taskResults.filter((r) => r.status === "failure").length;

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
      this.appendLog(`[orchestrate] Run history saved: ${entry.id} (${tasksCompleted} completed, ${tasksFailed} failed, $${totalCostUsd.toFixed(4)})`);
    } catch (err) {
      const msg = getErrorMessage(err, String(err));
      this.appendLog(`[orchestrate] Failed to save run history: ${msg}`);
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
