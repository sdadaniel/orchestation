import { OrchestrateEngine, EngineStatus } from "../core/orchestrate-engine";
import { appendRunHistory, type RunHistoryEntry } from "../../service/run-history";
import { parseCostLog } from "../../parser/cost-parser";
import { getErrorMessage } from "../../lib/errors/error-utils";
import { formatLogLine, normalizeLogEntry, normalizeLogLine, publish } from "../../bus";
import fs from "fs";
import path from "path";
import { LOGS_DIR } from "../../lib/config/paths";
import type { OrchestrationState, OrchestrationStatus, OrchestrationStatusData } from "./types";
import { MAX_STATE_LOG_LINES, ORCHESTRATE_LOG_RETENTION_DAYS, ORCHESTRATION_STATUS } from "./const";

class OrchestrationManager {
  private engine: OrchestrateEngine | null = null;

  private lastEmittedSnapshotJson: string | null = null;

  private lastLogPruneDay: string | null = null;

  private state: OrchestrationState = {
    status: ORCHESTRATION_STATUS.IDLE,
    startedAt: null,
    finishedAt: null,
    logs: [],
    logBase: 0,
    taskResults: [],
    exitCode: null,
  };

  constructor() {}

  /** 상태 변경 시 이벤트 버스에 발행 (WS gateway channel이 구독해 클라이언트로 전달) */
  private emitStatusChange(opts?: { log?: boolean }) {
    const log = opts?.log ?? true;
    const state = this.getState();
    const snapshot: OrchestrationStatusData = {
      status: state.status,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      exitCode: state.exitCode,
      taskResults: state.taskResults,
    };
    if (log) this.logStatusChangeIfNeeded(snapshot);
    publish("orchestration-status", snapshot);
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
    return this.state.status === ORCHESTRATION_STATUS.RUNNING;
  }

  // ── Run ────────────────────────────────────────────────

  run(): { success: boolean; error?: string } {
    if (this.isRunning()) {
      return { success: false, error: "Orchestration is already running" };
    }

    // 상태는 리셋하되, logs는 유지한다. (run/stop 이벤트도 포함해 연속 로그로 관측)
    this.state.status = ORCHESTRATION_STATUS.RUNNING;
    this.state.startedAt = new Date().toISOString();
    this.state.finishedAt = null;
    this.state.taskResults = [];
    this.state.exitCode = null;

    this.appendLog("[orchestrate] Starting Node.js engine");
    this.emitStatusChange({ log: false });

    // 엔진 생성 및 hooks 연결 (EventEmitter 제거)
    this.engine = new OrchestrateEngine({
      // 엔진 내부 로그는 외부 오케스트레이션 로그로 노출하지 않는다.
      onLog: () => {},
      onStatusChanged: (status: EngineStatus) => {
        if (status === "idle") {
          this.state.status = ORCHESTRATION_STATUS.IDLE;
          this.state.finishedAt = new Date().toISOString();
          this.state.exitCode ??= 0;
          this.saveRunHistory();
          this.emitStatusChange({ log: false });
        }
      },
      onTaskResult: (result) => {
        this.state.taskResults.push(result);
        publish("task-result", {
          taskId: result.taskId,
          status: result.status === "success" ? "completed" : "failed",
        });
        this.emitStatusChange({ log: false });
      },
    });

    const result = this.engine.start();
    if (!result.success) {
      this.state.status = ORCHESTRATION_STATUS.IDLE;
      this.state.finishedAt = new Date().toISOString();
      this.state.exitCode = 1;
      this.appendLog(`[orchestrate] Engine start failed: ${result.error}`);
      this.saveRunHistory();
      this.emitStatusChange();
    }

    return result;
  }

  // ── Stop ───────────────────────────────────────────────

  stop(): { success: boolean; error?: string } {
    const wasRunning = this.state.status === ORCHESTRATION_STATUS.RUNNING;

    if (this.engine) {
      this.engine.stop();
      this.engine = null;
    }

    if (wasRunning) {
      this.state.status = ORCHESTRATION_STATUS.IDLE;
      this.state.finishedAt = new Date().toISOString();
      this.state.exitCode ??= 0;
      this.saveRunHistory();
    }

    this.appendLog("[orchestrate] 전체 종료 완료");
    this.emitStatusChange({ log: false });
    return { success: true };
  }

  // ── Internal ───────────────────────────────────────────

  private getIsoDay(): string {
    // YYYY-MM-DD (UTC) — consistent with other ISO timestamps in the system.
    return new Date().toISOString().slice(0, 10);
  }

  private pruneOrchestrateLogsIfNeeded(today: string) {
    if (this.lastLogPruneDay === today) return;
    this.lastLogPruneDay = today;

    try {
      if (!fs.existsSync(LOGS_DIR)) return;
      const keepAfter =
        Date.now() - ORCHESTRATE_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const files = fs.readdirSync(LOGS_DIR);
      for (const f of files) {
        const m = f.match(/^orchestrate-(\d{4}-\d{2}-\d{2})\.log$/);
        if (!m) continue;
        const day = m[1];
        const ts = Date.parse(`${day}T00:00:00.000Z`);
        if (Number.isNaN(ts)) continue;
        if (ts < keepAfter) {
          try {
            fs.unlinkSync(path.join(LOGS_DIR, f));
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  private appendOrchestrateLogToFile(line: string) {
    const day = this.getIsoDay();
    const logFile = path.join(LOGS_DIR, `orchestrate-${day}.log`);
    try {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
      fs.appendFileSync(logFile, line + "\n");
    } catch {
      /* ignore */
    }
    this.pruneOrchestrateLogsIfNeeded(day);
  }

  private appendLog(line: string) {
    const normalized = normalizeLogLine(line, { defaultSource: "orchestrate" });
    this.state.logs.push(normalized);
    this.appendOrchestrateLogToFile(normalized);
    const entry = normalizeLogEntry(normalized, { defaultSource: "orchestrate" });
    publish("log", { scope: "orchestrate", entry });
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
      formatLogLine({
        source: "orchestrate",
        message: `status=${snapshot.status}${timing}${exit}${counts}`,
      }),
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
        this.state.exitCode === 0 ? "completed" : "failed";

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
    } catch (err) {
      const msg = getErrorMessage(err, String(err));
      // Keep history failures out of orchestrate logs to avoid noise.
      console.error(`[orchestrate] Failed to save run history: ${msg}`);
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
