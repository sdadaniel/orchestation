/**
 * orchestrate-engine.ts
 *
 * 오케스트레이션 메인 엔진 (얇은 조율자).
 * - scheduler.ts: 태스크 스케줄링 순수 함수
 * - signal-handler.ts: 시그널 처리/상태 전환
 */
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import {
  PROJECT_ROOT,
  OUTPUT_DIR,
  SIGNALS_DIR,
  CONFIG_PATH,
} from "../lib/paths";
import { loadSettings } from "../lib/settings";
import {
  getTask,
  getTasksByStatus,
  updateTask,
  updateTaskStatus,
} from "../service/task-store";
import { runJobTask } from "./job-task";
import { runJobReview } from "./job-review";
import {
  scanTasks,
  depsSatisfied,
  scopeNotConflicting,
  canDispatch,
  type TaskInfo,
} from "./scheduler";
import {
  processSignals,
  markTaskFailed,
  type SignalHandlerCallbacks,
} from "./signal-handler";

const RETRY_COUNTS_FILE = path.join(
  PROJECT_ROOT,
  ".orchestration",
  "retry-counts.json",
);

export type TaskStatus =
  | "pending"
  | "stopped"
  | "in_progress"
  | "reviewing"
  | "done"
  | "rejected"
  | "failed";
export type EngineStatus = "idle" | "running" | "completed" | "failed";

export interface EngineEvents {
  log: (line: string) => void;
  "status-changed": (status: EngineStatus) => void;
  "task-result": (result: {
    taskId: string;
    status: "success" | "failure";
  }) => void;
}

interface WorkerEntry {
  abortController: AbortController;
  promise: Promise<void>;
  taskId: string;
  phase: "task" | "review";
  startedAt: number;
}

const LOOP_INTERVAL_MS = 3000;

export class OrchestrateEngine extends EventEmitter {
  private workers = new Map<string, WorkerEntry>();
  private retryCounts = new Map<string, number>();
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private signalWatcher: fs.FSWatcher | null = null;
  private _status: EngineStatus = "idle";
  private baseBranchValue = "main";
  private maxParallelTask = 2;
  private maxParallelReview = 2;
  private maxReviewRetryValue = 3;
  private loopCount = 0;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  get status(): EngineStatus {
    return this._status;
  }
  get runningCount(): number {
    return this.workers.size;
  }

  start(): { success: boolean; error?: string } {
    if (this._status === "running")
      return { success: false, error: "Already running" };

    this.loadConfig();
    this._status = "running";
    this.loadRetryCounts();
    fs.mkdirSync(SIGNALS_DIR, { recursive: true });
    this.log("🚀 Pipeline 시작 (Node.js engine)");
    this.log(`⚙️  Base Branch: ${this.baseBranchValue}`);
    this.log(
      `⚙️  Max Parallel: task=${this.maxParallelTask}, review=${this.maxParallelReview}`,
    );
    this.emit("status-changed", this._status);
    this.cleanupZombies();
    this.startSignalWatcher();
    this.loopTimer = setInterval(() => this.mainLoop(), LOOP_INTERVAL_MS);
    this.mainLoop();
    return { success: true };
  }

  stop(): { success: boolean } {
    this.log("🛑 Pipeline 종료 요청");
    for (const [taskId, entry] of this.workers) {
      this.log(`  🛑 ${taskId}: 워커 종료`);
      entry.abortController.abort();
      this.setStatus(taskId, "stopped");
    }
    this.workers.clear();
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.signalWatcher) {
      this.signalWatcher.close();
      this.signalWatcher = null;
    }
    try {
      fs.rmSync(SIGNALS_DIR, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    this._status = "failed";
    this.log("🛑 Pipeline 종료 완료");
    this.emit("status-changed", this._status);
    return { success: true };
  }

  private loadConfig() {
    const settings = loadSettings();
    this.baseBranchValue = settings.baseBranch;
    this.maxReviewRetryValue = settings.maxReviewRetry;
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
        this.maxParallelTask = cfg.maxParallel?.task ?? settings.maxParallel;
        this.maxParallelReview =
          cfg.maxParallel?.review ?? settings.maxParallel;
      } else {
        this.maxParallelTask = settings.maxParallel;
        this.maxParallelReview = settings.maxParallel;
      }
    } catch {
      this.maxParallelTask = settings.maxParallel;
      this.maxParallelReview = settings.maxParallel;
    }
  }

  private buildSignalCallbacks(): SignalHandlerCallbacks {
    return {
      log: (msg) => this.log(msg),
      startTask: (taskId, feedbackFile) => this.startTask(taskId, feedbackFile),
      startReview: (taskId) => this.startReview(taskId),
      removeWorker: (taskId) => this.workers.delete(taskId),
      emitTaskResult: (taskId, status) =>
        this.emit("task-result", { taskId, status }),
      getRetryCount: (taskId) => this.retryCounts.get(taskId) ?? 0,
      bumpRetryCount: (taskId) => {
        const next = (this.retryCounts.get(taskId) ?? 0) + 1;
        this.retryCounts.set(taskId, next);
        this.saveRetryCounts();
        return next;
      },
      clearRetryCount: (taskId) => {
        if (this.retryCounts.delete(taskId)) this.saveRetryCounts();
      },
      maxReviewRetry: () => this.maxReviewRetryValue,
      baseBranch: () => this.baseBranchValue,
    };
  }

  private loadRetryCounts() {
    try {
      if (!fs.existsSync(RETRY_COUNTS_FILE)) {
        this.retryCounts = new Map();
        return;
      }
      const obj = JSON.parse(
        fs.readFileSync(RETRY_COUNTS_FILE, "utf-8"),
      ) as Record<string, number>;
      this.retryCounts = new Map(Object.entries(obj));
    } catch {
      this.retryCounts = new Map();
    }
  }

  private saveRetryCounts() {
    try {
      fs.mkdirSync(path.dirname(RETRY_COUNTS_FILE), { recursive: true });
      const obj: Record<string, number> = {};
      for (const [k, v] of this.retryCounts) obj[k] = v;
      fs.writeFileSync(RETRY_COUNTS_FILE, JSON.stringify(obj, null, 2));
    } catch {
      /* ignore */
    }
  }

  private startTask(taskId: string, feedbackFile?: string): boolean {
    const row = getTask(taskId);
    if (!row) {
      this.log(`  ❌ ${taskId}: 태스크 없음`);
      return false;
    }

    if (!row.branch) {
      const slug = taskId.toLowerCase();
      updateTask(taskId, {
        branch: `task/${slug}`,
        worktree: `../repo-wt-${slug}`,
      });
      this.log(`  📝 ${taskId}: branch/worktree 필드 자동 추가`);
    }

    this.setStatus(taskId, "in_progress");
    const logFile = path.join(OUTPUT_DIR, "logs", `${taskId}.log`);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const abortController = new AbortController();
    const promise = runJobTask(taskId, feedbackFile, (line) => {
      this.log(`  ${line}`);
      try {
        fs.appendFileSync(logFile, line + "\n");
      } catch {
        /* ignore */
      }
    })
      .then((result) => {
        this.log(`  [${taskId}/task] 완료: ${result.status}`);
      })
      .catch((err) => {
        this.log(
          `  ❌ ${taskId}: task 오류: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    this.workers.set(taskId, {
      abortController,
      promise,
      taskId,
      phase: "task",
      startedAt: Date.now(),
    });
    this.log(`  🔧 ${taskId}: job-task 시작`);
    return true;
  }

  private startReview(taskId: string): boolean {
    const logFile = path.join(OUTPUT_DIR, "logs", `${taskId}-review.log`);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const abortController = new AbortController();
    const promise = runJobReview(taskId, (line) => {
      this.log(`  ${line}`);
      try {
        fs.appendFileSync(logFile, line + "\n");
      } catch {
        /* ignore */
      }
    })
      .then((result) => {
        this.log(`  [${taskId}/review] 완료: ${result.status}`);
      })
      .catch((err) => {
        this.log(
          `  ❌ ${taskId}: review 오류: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    this.workers.set(taskId, {
      abortController,
      promise,
      taskId,
      phase: "review",
      startedAt: Date.now(),
    });
    this.log(`  🔍 ${taskId}: job-review 시작`);
    return true;
  }

  private startSignalWatcher() {
    try {
      this.signalWatcher = fs.watch(SIGNALS_DIR, () => {
        /* triggers processSignals on next loop */
      });
    } catch {
      /* polling fallback via mainLoop */
    }
  }

  private mainLoop() {
    if (this._status !== "running") return;
    this.loopCount++;
    if (this.loopCount % 10 === 0) this.loadConfig();

    processSignals(this.buildSignalCallbacks());

    const queue = scanTasks().filter(
      (t) =>
        (t.status === "pending" || t.status === "stopped") && depsSatisfied(t),
    );

    if (this.workers.size === 0 && queue.length === 0) {
      if (this.loopCount % 5 === 0) this.log("  ⏳ 새 태스크 대기 중...");
      return;
    }

    for (const task of queue) {
      if (this.workers.size >= this.maxParallelTask) break;
      if (this.workers.has(task.id)) continue;
      if (!scopeNotConflicting(task, this.workers, (msg) => this.log(msg)))
        continue;
      if (!canDispatch()) break;
      this.startTask(task.id);
      this.log(
        `  📊 슬롯: ${this.workers.size}/${this.maxParallelTask} (대기: ${queue.length})`,
      );
    }

    if (this.loopCount % 10 === 0) this.healthCheck();
  }

  private healthCheck() {
    for (const [taskId, entry] of this.workers) {
      const elapsed = Date.now() - entry.startedAt;
      if (elapsed > 1800000) {
        this.log(
          `  ⚠️  ${taskId}: 타임아웃 (${Math.round(elapsed / 60000)}분)`,
        );
        entry.abortController.abort();
        this.workers.delete(taskId);
        markTaskFailed(
          taskId,
          "워커 타임아웃 (30분)",
          this.buildSignalCallbacks(),
        );
      }
    }
  }

  private cleanupZombies() {
    const zombies = getTasksByStatus("in_progress");
    let cleaned = 0;
    const cb = this.buildSignalCallbacks();
    for (const row of zombies) {
      if (this.workers.has(row.id)) continue;
      // 엔진이 모르는 in_progress = 프로세스 크래시/재시작으로 인한 고아 태스크.
      // 재실행하지 않도록 failed로 마킹 (무한 루프/토큰 낭비 방지)
      markTaskFailed(
        row.id,
        "고아 상태 감지 (엔진 크래시 또는 비정상 종료 추정)",
        cb,
      );
      cleaned++;
      this.log(`  🧹 zombie: ${row.id} in_progress → failed`);
    }
    if (cleaned > 0) this.log(`  🧹 ${cleaned}개 좀비 태스크 failed 처리`);
  }

  private setStatus(taskId: string, newStatus: TaskStatus) {
    const row = getTask(taskId);
    if (!row) return;
    updateTaskStatus(taskId, newStatus, row.status);
  }

  private log(line: string) {
    this.emit("log", line);
  }
}
