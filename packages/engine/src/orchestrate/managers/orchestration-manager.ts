import { OrchestrateEngine, EngineStatus } from "../core/orchestrate-engine";
import { appendRunHistory, type RunHistoryEntry } from "../../service/run-history";
import { parseCostLog } from "../../parser/cost-parser";
import { getErrorMessage } from "../../lib/errors/error-utils";
import { normalizeLogEntry, normalizeLogLine, publish } from "@/bus/index";
import fs from "fs";
import path from "path";
import { LOGS_DIR } from "../../lib/config/paths";
import { loadSettings } from "../../lib/config/settings";
import type { OrchestrationState, OrchestrationStatus, OrchestrationStatusData } from "./types";
import { MAX_STATE_LOG_LINES, ORCHESTRATION_STATUS } from "./const";

class OrchestrationManager {
  private engine: OrchestrateEngine | null = null;

  /** `await engine.start()` 동안에는 `state`가 아직 RUNNING이 아니므로, 중복 기동만 막는다. */
  private engineStartInProgress = false;

  /** RUNNING 세션에 대해 아직 `Orchestration shutdown complete`를 남기지 않았을 때만 true */
  private pendingOrchestrationEndLog = false;

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

  /** 현재 상태 스냅샷을 이벤트 버스에 발행 (WS gateway channel이 구독해 클라이언트로 전달) */
  private emitStatusSnapshot() {
    const state = this.getState();
    const snapshot: OrchestrationStatusData = {
      status: state.status,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      exitCode: state.exitCode,
      taskResults: state.taskResults,
    };
    publish("orchestration.status", snapshot);
  }

  publishCurrentStatus() {
    this.emitStatusSnapshot();
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

  getRecentLogs(limit: number = 200): string[] {
    const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
    try {
      if (!fs.existsSync(LOGS_DIR)) {
        return this.state.logs.slice(-safeLimit);
      }
      const files = fs
        .readdirSync(LOGS_DIR)
        .filter((name) => /^orchestrate-\d{4}-\d{2}-\d{2}\.log$/.test(name))
        .sort();
      const collected: string[] = [];
      for (let i = files.length - 1; i >= 0 && collected.length < safeLimit; i--) {
        const filePath = path.join(LOGS_DIR, files[i]!);
        const lines = fs
          .readFileSync(filePath, "utf-8")
          .split(/\r?\n/)
          .filter((line) => line.length > 0);
        if (lines.length === 0) continue;
        const need = safeLimit - collected.length;
        collected.unshift(...lines.slice(-need));
      }
      if (collected.length > 0) return collected;
    } catch {
      // ignore and fallback to in-memory logs
    }
    return this.state.logs.slice(-safeLimit);
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

  /**
   * `config.json` 저장 직후: 실행 중인 엔진이 있으면 디스크에서 다시 읽어 반영한다.
   * idle이면 엔진 인스턴스가 없으므로 no-op(다음 `start()` 시 `loadConfig`로 반영).
   */
  reloadEngineConfigFromDisk(): { reloaded: boolean; reason?: "engine_idle" } {
    if (!this.isRunning() || !this.engine) {
      return { reloaded: false, reason: "engine_idle" };
    }
    this.engine.reloadConfigFromDisk();
    return { reloaded: true };
  }

  /** 엔진 start 실패 시: 엔진 정리 + 세션 종료 상태로 롤백 (logs는 유지) */
  private async handleEngineStartFailure(message: string) {
    if (this.engine) {
      await this.engine.stop();
      this.engine = null;
    }
    this.state.status = ORCHESTRATION_STATUS.IDLE;
    this.state.finishedAt = new Date().toISOString();
    this.state.exitCode = 1;
    this.appendLog(`[orchestrate] Engine start failed: ${message}`);
    this.saveRunHistory();
    this.emitStatusSnapshot();
  }

  // ── Start (orchestration session) ─────────────────────

  async start(): Promise<{ success: boolean; error?: string }> {
    if (this.isRunning()) {
      return { success: false, error: "Orchestration is already running" };
    }
    if (this.engineStartInProgress) {
      return {
        success: false,
        error: "Orchestration start already in progress",
      };
    }

    this.engineStartInProgress = true;
    try {
      // 엔진 생성 및 hooks 연결 (EventEmitter 제거)
      this.engine = new OrchestrateEngine({
        // 엔진 내부 로그는 외부 오케스트레이션 로그로 노출하지 않는다.
        onLog: () => {},
        onStatusChanged: (status: EngineStatus) => {
          if (status === "idle") {
            const wasRunning =
              this.state.status === ORCHESTRATION_STATUS.RUNNING;
            this.state.status = ORCHESTRATION_STATUS.IDLE;
            this.state.finishedAt = new Date().toISOString();
            this.state.exitCode ??= 0;
            this.saveRunHistory();
            this.emitStatusSnapshot();
            if (wasRunning && this.pendingOrchestrationEndLog) {
              this.appendLog(
                "[orchestrate] Orchestration shutdown complete",
              );
              this.pendingOrchestrationEndLog = false;
            }
          }
        },
        onTaskResult: (result) => {
          this.state.taskResults.push(result);
          publish("task.result", {
            taskId: result.taskId,
            status: result.status === "success" ? "completed" : "failed",
          });
          this.emitStatusSnapshot();
        },
      });

      let result: { success: boolean; error?: string };
      try {
        result = await this.engine.start();
      } catch (err) {
        const msg = getErrorMessage(err);
        await this.handleEngineStartFailure(msg);
        return { success: false, error: msg };
      }

      if (!result.success) {
        await this.handleEngineStartFailure(result.error ?? "start-failed");
        return result;
      }

      // 상태는 리셋하되, logs는 유지한다. (start/stop 이벤트도 포함해 연속 로그로 관측)
      this.state.status = ORCHESTRATION_STATUS.RUNNING;
      this.state.startedAt = new Date().toISOString();
      this.state.finishedAt = null;
      this.state.taskResults = [];
      this.state.exitCode = null;
      this.pendingOrchestrationEndLog = true;
      this.emitStatusSnapshot();
      this.appendLog("[orchestrate] Orchestration startup complete");

      return result;
    } finally {
      this.engineStartInProgress = false;
    }
  }

  // ── Stop ───────────────────────────────────────────────

  async stop(): Promise<{ success: boolean; error?: string }> {
    const wasRunning = this.state.status === ORCHESTRATION_STATUS.RUNNING;

    if (this.engine) {
      await this.engine.stop();
      this.engine = null;
    }

    if (wasRunning) {
      this.state.status = ORCHESTRATION_STATUS.IDLE;
      this.state.finishedAt = new Date().toISOString();
      this.state.exitCode ??= 0;
      this.saveRunHistory();
    }

    this.emitStatusSnapshot();
    if (wasRunning && this.pendingOrchestrationEndLog) {
      this.appendLog("[orchestrate] Orchestration shutdown complete");
      this.pendingOrchestrationEndLog = false;
    }
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
        Date.now() -
        loadSettings().orchestrateLogRetentionDays * 24 * 60 * 60 * 1000;
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

  /**
   * 브라우저 콘솔에만 노출되는 로그 (Logs 탭/파일/상태 logs에는 축적하지 않음)
   */
  private publishConsoleLog(line: string) {
    const entry = normalizeLogEntry(line, { defaultSource: "orchestrate" });
    publish("log.console", { scope: "orchestrate", entry });
  }

  private appendLog(line: string) {
    const normalized = normalizeLogLine(line, { defaultSource: "orchestrate" });
    this.state.logs.push(normalized);
    this.appendOrchestrateLogToFile(normalized);
    const entry = normalizeLogEntry(normalized, { defaultSource: "orchestrate" });
    publish("log.dashboard", { scope: "orchestrate", entry });
    if (this.state.logs.length > MAX_STATE_LOG_LINES) {
      const drop = this.state.logs.length - MAX_STATE_LOG_LINES;
      this.state.logs.splice(0, drop);
      this.state.logBase += drop;
    }
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
        id: `start-${this.state.startedAt.replace(/[^0-9]/g, "").slice(0, 14)}`,
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

const orchestrationManager = new OrchestrationManager();
export default orchestrationManager;
