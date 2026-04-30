/**
 * orchestrate-engine.ts
 *
 * 오케스트레이션 메인 엔진 (얇은 조율자).
 * - scheduler.ts: 태스크 스케줄링 순수 함수
 * - task-transitions.ts: 태스크 상태 전이
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT, OUTPUT_DIR, CONFIG_PATH } from "../../lib/config/paths";
import { loadSettings } from "../../lib/config/settings";
import {
  getTask,
  getTaskStep,
  getNextPendingStep,
  ensureTaskSteps,
  getTasksByStatus,
  recordStepEvent,
  updateTask,
  updateTaskPhase,
  updateTaskStatus,
  updateTaskStep,
} from "../../service/task-store";
import { parseWorkflowFromTaskContent } from "../workflow";
import { runStep } from "../runner/step-runner";
import {
  scanTasks,
  depsSatisfied,
  scopeNotConflicting,
  canDispatch,
} from "./scheduler";
import {
  onStepFinished,
  markTaskFailed,
  type TransitionContext,
} from "./task-transitions";
import { normalizeLogEntry, publish } from "@/bus/index";
import { formatLogLine } from "@/bus/logging/log-format";
import { taskStatusToResultOutcome } from "../../lib/task-status";
import type { TaskStatus } from "../../entities/task";
import type { StepType } from "../runner/step-runner";
import {
  CONFIG_WATCH_INTERVAL_MS,
  HEALTHCHECK_EVERY_N_LOOPS,
  LOOP_INTERVAL_MS,
} from "./const";

export type EngineStatus = "idle" | "running";

export interface EngineEvents {
  log: (line: string) => void;
  "status-changed": (status: EngineStatus) => void;
  "task.result": (result: {
    taskId: string;
    status: "success" | "failure";
  }) => void;
}

export type EngineHooks = {
  onLog?: (line: string) => void;
  onStatusChanged?: (status: EngineStatus) => void;
  onTaskResult?: (result: { taskId: string; status: "success" | "failure" }) => void;
};

interface WorkerEntry {
  abortController: AbortController;
  promise: Promise<void>;
  taskId: string;
  stepId: string;
  stepType: StepType;
  startedAt: number;
}

export class OrchestrateEngine {
  private workers = new Map<string, WorkerEntry>();
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private configWatchArmed = false;
  private lastConfigMtimeMs: number | null = null;
  private _status: EngineStatus = "idle";
  private baseBranchValue = "main";
  private maxParallelTask = 2;
  private maxParallelReview = 2;
  private maxReviewRetryValue = 3;
  private loopCount = 0;

  private hooks: Required<EngineHooks>;

  constructor(hooks?: EngineHooks) {
    this.hooks = {
      onLog: hooks?.onLog ?? (() => {}),
      onStatusChanged: hooks?.onStatusChanged ?? (() => {}),
      onTaskResult: hooks?.onTaskResult ?? (() => {}),
    };
  }

  private emitLog(line: string) {
    this.hooks.onLog(line);
  }
  private emitStatusChanged(status: EngineStatus) {
    this.hooks.onStatusChanged(status);
  }
  /** `task-store`에 반영된 최신 `TaskEntity.status` 기준으로 훅을 호출한다. */
  private emitTaskResult(taskId: string) {
    const row = getTask(taskId);
    if (!row) {
      this.log(`  ⚠️  emitTaskResult: 태스크 없음 ${taskId}`);
      return;
    }
    const outcome = taskStatusToResultOutcome(row.status);
    if (outcome === undefined) {
      this.log(
        `  ⚠️  emitTaskResult: 종료 상태 아님 (${taskId} → ${row.status})`,
      );
      return;
    }
    this.hooks.onTaskResult({ taskId, status: outcome });
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
    this.armConfigWatch();
    this._status = "running";
    this.logInfo("Engine started");
    this.emitStatusChanged(this._status);
    this.cleanupZombies();
    this.loopTimer = setInterval(() => this.mainLoop(), LOOP_INTERVAL_MS);
    this.mainLoop(); // 첫 턴도 즉시 실행
    return { success: true };
  }

  stop(): { success: boolean } {
    // Keep stop quiet; the manager will emit a single final log line.
    for (const [taskId, entry] of this.workers) {
      entry.abortController.abort();
      this.setStatus(taskId, "stopped");
    }
    this.workers.clear();
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.disarmConfigWatch();
    this._status = "idle";
    return { success: true };
  }

  private armConfigWatch() {
    if (this.configWatchArmed) return;
    this.configWatchArmed = true;

    try {
      this.lastConfigMtimeMs = fs.existsSync(CONFIG_PATH)
        ? fs.statSync(CONFIG_PATH).mtimeMs
        : null;
    } catch {
      this.lastConfigMtimeMs = null;
    }

    fs.watchFile(
      CONFIG_PATH,
      { interval: CONFIG_WATCH_INTERVAL_MS },
      (curr, prev) => {
        if (this._status !== "running") return;
        if (!this.configWatchArmed) return;
        // mtime 기반으로 “저장”만 감지해서 리로드한다.
        const currMs = Number(curr?.mtimeMs) || 0;
        const prevMs = Number(prev?.mtimeMs) || 0;
        if (currMs === 0 || currMs === prevMs) return;
        if (this.lastConfigMtimeMs !== null && currMs === this.lastConfigMtimeMs)
          return;
        this.lastConfigMtimeMs = currMs;
        this.loadConfig();
      },
    );
  }

  private disarmConfigWatch() {
    if (!this.configWatchArmed) return;
    this.configWatchArmed = false;
    try {
      fs.unwatchFile(CONFIG_PATH);
    } catch {
      // ignore
    }
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

  /** task-transitions 용 컨텍스트. */
  private buildTransitionContext(): TransitionContext {
    return {
      log: (msg) => this.log(msg),
      startStep: (taskId, stepId, opts) => this.startStep(taskId, stepId, opts),
      emitTaskResult: (taskId) => this.emitTaskResult(taskId),
      maxReviewRetry: () => this.maxReviewRetryValue,
      baseBranch: () => this.baseBranchValue,
    };
  }

  /**
   * 주어진 이름의 로컬 브랜치가 base 와 다른 커밋을 가지고 있는지 확인한다.
   * (브랜치 없음 또는 base 와 동일 → false)
   */
  private branchHasUnrelatedHistory(branchName: string): boolean {
    // 1) 해당 이름의 로컬 브랜치가 실제로 존재하는지 확인 (없으면 안전하므로 false)
    try {
      execSync(
        `git -C "${PROJECT_ROOT}" show-ref --verify --quiet "refs/heads/${branchName}"`,
        { stdio: "ignore" },
      );
    } catch {
      return false;
    }
    // 2) base..branch 범위에 커밋이 있으면(=base에 없는 커밋이 남아있으면) 재사용 위험 → true
    try {
      const commits = execSync(
        `git -C "${PROJECT_ROOT}" log --oneline "${this.baseBranchValue}..${branchName}"`,
        { encoding: "utf-8" },
      ).trim();
      return commits.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 브랜치와 연결된 worktree 를 강제로 제거한다.
   * 정리 실패해도 throw 하지 않음 (호출자는 "정리됐다고 가정"하고 이어감).
   */
  private forceCleanBranchAndWorktree(
    branchName: string,
    worktreePath: string,
  ) {
    const fullWorktreePath = path.resolve(PROJECT_ROOT, worktreePath);
    if (fs.existsSync(fullWorktreePath)) {
      try {
        execSync(
          `git -C "${PROJECT_ROOT}" worktree remove "${fullWorktreePath}" --force`,
          { stdio: "ignore" },
        );
      } catch {
        /* ignore */
      }
      try {
        fs.rmSync(fullWorktreePath, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    try {
      execSync(`git -C "${PROJECT_ROOT}" worktree prune`, { stdio: "ignore" });
    } catch {
      /* ignore */
    }
    try {
      execSync(`git -C "${PROJECT_ROOT}" branch -D "${branchName}"`, {
        stdio: "ignore",
      });
    } catch {
      /* ignore */
    }
  }

  private startStep(
    taskId: string,
    stepId: string,
    opts?: { feedbackFile?: string },
  ): boolean {
    const row = getTask(taskId);
    if (!row) {
      this.log(`  ❌ ${taskId}: 태스크 없음`);
      return false;
    }

    const step = getTaskStep(stepId);
    if (!step) {
      this.log(`  ❌ ${taskId}: step 없음: ${stepId}`);
      return false;
    }

    const slug = taskId.toLowerCase();
    const branchName = row.branch || `task/${slug}`;
    const worktreePath = row.worktree || `../repo-wt-${slug}`;

    // 재사용 가드: 같은 이름의 브랜치가 base 와 다른 히스토리를 가지면
    // 이전 작업(또는 동명의 수동 브랜치)이 남아있는 것 — 강제 정리.
    // 이대로 두면 엔진이 무관한 커밋 위에서 작업하다 main 으로 머지할 때
    // 대규모 충돌이 발생한다.
    if (this.branchHasUnrelatedHistory(branchName)) {
      this.log(
        `  🧹 ${taskId}: 기존 브랜치 ${branchName} 에 무관 커밋 감지 → 강제 정리`,
      );
      this.forceCleanBranchAndWorktree(branchName, worktreePath);
    }

    if (!row.branch) {
      updateTask(taskId, {
        branch: branchName,
        worktree: worktreePath,
      });
      this.log(`  📝 ${taskId}: branch/worktree 필드 자동 추가`);
    }

    // task.status는 coarse 상태만 유지하고(=in_progress),
    // step 타입에 따른 세부 상태는 task.phase로 구분한다.
    this.setStatus(taskId, "in_progress");
    updateTaskPhase(taskId, step.step_type === "review" ? "reviewing" : "working");
    
    updateTaskStep(stepId, {
      status: "in_progress",
      started_at: new Date().toISOString(),
    });
    recordStepEvent(taskId, stepId, "step_start", step.step_key);
    const logFile = path.join(
      OUTPUT_DIR,
      "logs",
      `${taskId}-${step.step_key}.log`,
    );
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const abortController = new AbortController();
    const writeLine = (line: string) => {
      this.log(`  ${line}`);
      publish("log", {
        scope: "task",
        taskId,
        entry: normalizeLogEntry(line, { defaultSource: "task" }),
      });
      try {
        fs.appendFileSync(logFile, line + "\n");
      } catch {
        /* ignore */
      }
    };

    const promise = runStep({
      stepType: step.step_type,
      taskId,
      stepId,
      feedbackFile: opts?.feedbackFile,
      log: writeLine,
    });

    const workerKey = `${taskId}:${stepId}`;
    const wrapped = promise
      .then(async (result) => {
        this.log(`  [${taskId}/${step.step_key}] 완료`);
        this.workers.delete(workerKey);
        await onStepFinished(
          taskId,
          stepId,
          step.step_type,
          (result as { raw: unknown }).raw as never,
          this.buildTransitionContext(),
        );
      })
      .catch(async (err) => {
        this.log(
          `  ❌ ${taskId}: step 오류(${step.step_key}): ${err instanceof Error ? err.message : String(err)}`,
        );
        this.workers.delete(workerKey);
        if (step.step_type === "review") {
          await onStepFinished(
            taskId,
            stepId,
            step.step_type,
            { status: "review-rejected" } as never,
            this.buildTransitionContext(),
          );
        } else {
          await onStepFinished(
            taskId,
            stepId,
            step.step_type,
            { status: "task-failed" } as never,
            this.buildTransitionContext(),
          );
        }
      });

    this.workers.set(workerKey, {
      abortController,
      promise: wrapped,
      taskId,
      stepId,
      stepType: step.step_type,
      startedAt: Date.now(),
    });

    this.log(
      `  ▶️  ${taskId}: step 시작: ${step.step_key} (${step.step_type})`,
    );
    return true;
  }

  /** running 동안 LOOP_INTERVAL_MS 마다 호출. 실행 가능한 큐 디스패치 + 주기적 설정 리로드/워커 타임아웃 검사. */
  private mainLoop() {
    if (this._status !== "running") return;
    this.loopCount++;

    const queue = scanTasks().filter(
      (t) =>
        (t.status === "pending" || t.status === "stopped") && depsSatisfied(t),
    );
  

    for (const task of queue) {
      if (this.workers.size >= this.maxParallelTask) break;
      // One active worker per task at a time (even if multiple steps exist)
      // 동일 taskId의 step을 중복 디스패치하지 않기 위해, 이미 실행 중인 워커가 있으면 건너뛴다.
      if ([...this.workers.values()].some((w) => w.taskId === task.id))
        continue;

    
      // 실행 중 워커들과 scope가 충돌하면(같은 범위를 동시에 만지면) 병렬 실행을 피한다.
      if (!scopeNotConflicting(task, this.workers, (msg) => this.log(msg)))
        continue;

      
      // 메모리 압박(예: macOS `memory_pressure`가 warn/critical) 상태면 새 워커 디스패치를 중단한다.
      if (!canDispatch()) break;

      // Ensure workflow/steps exist, then start next pending step
      const row = getTask(task.id);
      if (!row) continue;
      const defs = parseWorkflowFromTaskContent(row.content || "");
      ensureTaskSteps(task.id, defs);
      const next = getNextPendingStep(task.id);
      if (!next) {
        this.log(`  ⚠️  ${task.id}: 실행할 step 없음`);
        continue;
      }
      this.startStep(task.id, next.id);
      this.log(
        `  📊 슬롯: ${this.workers.size}/${this.maxParallelTask} (대기: ${queue.length})`,
      );
    }

    if (this.loopCount % HEALTHCHECK_EVERY_N_LOOPS === 0)
      this.healthCheck();
  }

  /** 너무 오래 도는 워커 중단 및 태스크 failed 처리. */
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
          this.buildTransitionContext(),
        );
      }
    }
  }

  private cleanupZombies() {
    const zombies = getTasksByStatus("in_progress");
    let cleaned = 0;
    const ctx = this.buildTransitionContext();
    for (const row of zombies) {
      if (this.workers.has(row.id)) continue;
      // 엔진이 모르는 in_progress = 프로세스 크래시/재시작으로 인한 고아 태스크.
      // 재실행하지 않도록 failed로 마킹 (무한 루프/토큰 낭비 방지)
      markTaskFailed(
        row.id,
        "고아 상태 감지 (엔진 크래시 또는 비정상 종료 추정)",
        ctx,
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
    this.emitLog(line);
  }

  private logInfo(message: string) {
    this.emitLog(
      formatLogLine({
        source: "engine",
        message,
      }),
    );
  }
}
