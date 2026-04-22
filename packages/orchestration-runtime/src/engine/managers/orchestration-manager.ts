import { EventEmitter } from "events";
import { OrchestrateEngine, EngineStatus } from "../core/orchestrate-engine";
import { appendRunHistory, type RunHistoryEntry } from "../../service/run-history";
import { parseCostLog } from "../../parser/cost-parser";
import { getErrorMessage } from "../../lib/error-utils";

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
  /** logs[0]가 의미하는 절대 인덱스 (클리핑 시 증가) */
  logBase: number;
  taskResults: TaskResult[];
  exitCode: number | null;
}

// UI도 200줄만 보여주므로, 서버 상태도 200줄로 클리핑해 메모리를 안정적으로 유지한다.
const MAX_STATE_LOG_LINES = 200;

class OrchestrationManager {
  private engine: OrchestrateEngine | null = null;

  /** SSE 클라이언트에게 상태 변경을 알리기 위한 이벤트 버스 */
  public readonly events = new EventEmitter();

  private lastEmittedSnapshotJson: string | null = null;

  private state: OrchestrationState = {
    status: "idle",
    startedAt: null,
    finishedAt: null,
    logs: [],
    logBase: 0,
    taskResults: [],
    exitCode: null,
  };

  constructor() {
    this.events.setMaxListeners(50);
  }

  /** 상태 변경 시 SSE 클라이언트에 알림 */
  private emitStatusChange() {
    const state = this.getState();
    const snapshot: OrchestrationStatusData = {
      status: state.status,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      exitCode: state.exitCode,
      taskResults: state.taskResults,
    };
    this.logStatusChangeIfNeeded(snapshot);
    this.events.emit("status-changed", snapshot);
  }

  // ── Public API ─────────────────────────────────────────

  getState(): OrchestrationState {
    return {
      ...this.state,
      logs: [...this.state.logs],
      taskResults: [...this.state.taskResults],
    };
  }

  getStatus(): OrchestrationStatus {
    return this.state.status;
  }

  getLogs(since: number = 0): string[] {
    // since는 절대 인덱스. 클리핑으로 앞부분이 날아간 경우, 현재 보유분을 전부 반환한다.
    const start = Math.max(0, since - this.state.logBase);
    return this.state.logs.slice(start);
  }

  /**
   * 외부(대시보드 API 등)에서 로그 라인을 남길 때 사용.
   * 내부 포맷/정규화 규칙은 appendLog에 위임한다.
   */
  addLog(line: string) {
    this.appendLog(line);
  }

  isRunning(): boolean {
    return this.state.status === "running";
  }

  // ── Run ────────────────────────────────────────────────

  run(): { success: boolean; error?: string } {
    if (this.isRunning()) {
      return { success: false, error: "Orchestration is already running" };
    }

    // 상태는 리셋하되, logs는 유지한다. (run/stop 이벤트도 포함해 연속 로그로 관측)
    this.state.status = "running";
    this.state.startedAt = new Date().toISOString();
    this.state.finishedAt = null;
    this.state.taskResults = [];
    this.state.exitCode = null;

    this.appendLog("[orchestrate] Starting Node.js engine");
    this.emitStatusChange();

    // 엔진 생성 및 이벤트 연결
    this.engine = new OrchestrateEngine();

    this.engine.on("log", (line: string) => {
      this.appendLog(line);
    });

    this.engine.on("status-changed", (status: EngineStatus) => {
      if (status === "idle" || status === "completed") {
        this.state.status = status;
        this.state.finishedAt = new Date().toISOString();
        this.state.exitCode = 0;
        this.saveRunHistory();
        this.emitStatusChange();
      }
    });

    this.engine.on(
      "task-result",
      (result: { taskId: string; status: "success" | "failure" }) => {
        this.state.taskResults.push(result);
        this.emitStatusChange();
      },
    );

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
    } else if (this.state.status === "running") {
      this.state.status = "idle";
      this.state.finishedAt = new Date().toISOString();
      this.state.exitCode = 0;
      this.saveRunHistory();
    }

    this.appendLog("[orchestrate] 전체 종료 완료");
    this.emitStatusChange();
    return { success: true };
  }

  // ── Internal ───────────────────────────────────────────

  private appendLog(line: string) {
    const trimmed = line.trim();
    const looksLikeHmsInfo = /^\d{2}:\d{2}:\d{2}\s+info\s+\S+\s+/i.test(trimmed);
    const looksLikeIsoInfo = /^\d{4}-\d{2}-\d{2}T[^\s]+\s+INFO\s+/i.test(trimmed);
    const normalized =
      looksLikeHmsInfo || looksLikeIsoInfo
        ? trimmed
        : `${new Date().toISOString()} INFO ${trimmed}`;

    this.state.logs.push(normalized);
    if (this.state.logs.length > MAX_STATE_LOG_LINES) {
      const drop = this.state.logs.length - MAX_STATE_LOG_LINES;
      this.state.logs.splice(0, drop);
      this.state.logBase += drop;
    }
  }

  private logStatusChangeIfNeeded(snapshot: OrchestrationStatusData) {
    const stable = JSON.stringify(snapshot);
    if (this.lastEmittedSnapshotJson === stable) return;
    this.lastEmittedSnapshotJson = stable;

    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const ts = `${hh}:${mm}:${ss}`;

    // OpenClaw-ish: HH:MM:SS info orchestrate message
    // Keep it human-readable but include key fields for future extensibility.
    const ok = snapshot.taskResults.filter((r) => r.status === "success").length;
    const fail = snapshot.taskResults.filter((r) => r.status === "failure").length;
    const timing =
      snapshot.startedAt || snapshot.finishedAt
        ? ` startedAt=${snapshot.startedAt ?? "-"} finishedAt=${snapshot.finishedAt ?? "-"}`
        : "";
    const exit = snapshot.exitCode !== null ? ` exitCode=${snapshot.exitCode}` : "";
    const counts = snapshot.taskResults.length > 0 ? ` ok=${ok} fail=${fail}` : "";

    this.appendLog(
      `${ts} info orchestrate status=${snapshot.status}${timing}${exit}${counts}`,
    );
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
      } catch {
        /* ignore */
      }

      const tasksCompleted = this.state.taskResults.filter(
        (r) => r.status === "success",
      ).length;
      const tasksFailed = this.state.taskResults.filter(
        (r) => r.status === "failure",
      ).length;

      const historyStatus: "completed" | "failed" =
        this.state.status === "failed" ? "failed" : "completed";

      const entry: RunHistoryEntry = {
        id: `run-${this.state.startedAt.replace(/[^0-9]/g, "").slice(0, 14)}`,
        startedAt: this.state.startedAt,
        finishedAt: this.state.finishedAt,
        status: historyStatus,
        exitCode: this.state.exitCode,
        taskResults: [...this.state.taskResults],
        totalCostUsd: parseFloat(totalCostUsd.toFixed(6)),
        totalDurationMs: durationMs,
        tasksCompleted,
        tasksFailed,
      };

      appendRunHistory(entry);
      this.appendLog(
        `[orchestrate] Run history saved: ${entry.id} (${tasksCompleted} completed, ${tasksFailed} failed, $${totalCostUsd.toFixed(4)})`,
      );
    } catch (err) {
      const msg = getErrorMessage(err, String(err));
      this.appendLog(`[orchestrate] Failed to save run history: ${msg}`);
    }
  }
}

// Singleton — survives Next.js HMR by storing on globalThis
const globalKey = "__orchestrationManager__" as keyof typeof globalThis;
const existing = (globalThis as Record<string, unknown>)[
  globalKey
] as OrchestrationManager | undefined;

// HMR에서 이전 클래스 인스턴스가 남아있을 수 있다.
// Next dev(HMR)에서 메서드 구현이 바뀌면 prototype을 최신으로 맞춰야 한다.
// (run()이 logs를 리셋하는/안 하는 등의 변경이 즉시 반영되어야 함)
if (existing) {
  Object.setPrototypeOf(existing, OrchestrationManager.prototype);
  // HMR로 필드가 추가된 경우(예: logBase) 런타임 상태를 보정한다.
  const state = (existing as unknown as { state?: unknown }).state as
    | { logBase?: unknown }
    | undefined;
  if (state && typeof state.logBase !== "number") {
    state.logBase = 0;
  }
}

const orchestrationManager: OrchestrationManager =
  existing ??
  (() => {
    const m = new OrchestrationManager();
    (globalThis as Record<string, unknown>)[globalKey] = m;
    return m;
  })();
export default orchestrationManager;

