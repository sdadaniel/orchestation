import { ChildProcess, spawn } from "child_process";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { killProcessGracefully } from "../../lib/process-utils";
import { PROJECT_ROOT, LOGS_DIR } from "../../lib/paths";
import { TaskRunState } from "./task-runner-types";
import {
  getWorkerMode,
  runInIterm,
  updateTaskFileStatus,
  cleanupSignals,
  killItermTask,
  shouldSkipReview,
} from "./task-runner-utils";
import {
  ItermWatcherManager,
  watchItermCompletion,
  startReviewInIterm,
} from "./task-runner-iterm";
import { runJobTask } from "../job-task";
import { runJobReview } from "../job-review";
import { runMergeTask } from "../merge-utils";

export type {
  TaskRunStatus,
  TaskRunPhase,
  TaskRunState,
} from "./task-runner-types";

class TaskRunnerManager {
  /** Currently running tasks keyed by task ID */
  private runs: Map<
    string,
    {
      state: TaskRunState;
      process: ChildProcess | null;
      abortController?: AbortController;
    }
  > = new Map();

  /** iTerm 모드 watcher (stop 시 정리용) */
  private watcherMgr = new ItermWatcherManager();

  /** Event emitter for log streaming: emits "log:<taskId>" with line string, "done:<taskId>" on finish */
  public events = new EventEmitter();

  getState(taskId: string): TaskRunState | null {
    const run = this.runs.get(taskId);
    return run ? { ...run.state, logs: [...run.state.logs] } : null;
  }

  isRunning(taskId: string): boolean {
    return this.runs.get(taskId)?.state.status === "running";
  }

  /** Returns all task IDs that are currently running */
  getRunningIds(): string[] {
    const ids: string[] = [];
    for (const [id, run] of this.runs) {
      if (run.state.status === "running") ids.push(id);
    }
    return ids;
  }

  run(taskId: string): { success: boolean; error?: string } {
    if (this.isRunning(taskId)) {
      return { success: false, error: `Task ${taskId} is already running` };
    }

    const workerMode = getWorkerMode();

    const state: TaskRunState = {
      taskId,
      status: "running",
      phase: "task",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logs: [],
      exitCode: null,
    };

    state.logs.push(
      `[task-runner] Starting ${taskId} at ${state.startedAt} (mode: ${workerMode})`,
    );
    updateTaskFileStatus(taskId, "in_progress");

    if (workerMode === "iterm") {
      return this.runIterm(taskId, state);
    }
    return this.runBackground(taskId, state);
  }

  /** 백그라운드 모드: Node.js native 실행 */
  private runBackground(
    taskId: string,
    state: TaskRunState,
  ): { success: boolean; error?: string } {
    const abortController = new AbortController();
    this.runs.set(taskId, { state, process: null, abortController });

    // 비동기 실행 시작
    this.runBackgroundAsync(taskId, state, abortController);

    return { success: true };
  }

  private async runBackgroundAsync(
    taskId: string,
    state: TaskRunState,
    abortController: AbortController,
  ) {
    // 로그 파일 생성 (UI Terminal/로그 탭 file watch용)
    const logFile = path.join(LOGS_DIR, `${taskId}.log`);
    fs.mkdirSync(LOGS_DIR, { recursive: true });

    const appendLog = (line: string) => {
      state.logs.push(line);
      this.events.emit(`log:${taskId}`, line);
      try {
        fs.appendFileSync(logFile, line + "\n");
      } catch {
        /* ignore */
      }
    };

    try {
      // 1. Task 실행
      const taskResult = await runJobTask(taskId, undefined, appendLog);

      if (taskResult.status === "task-rejected") {
        state.status = "completed";
        state.phase = "done";
        state.exitCode = 2;
        state.finishedAt = new Date().toISOString();
        cleanupSignals(taskId);
        appendLog(`[task-runner] ${taskId} 거절됨 → 완료 처리 (review 스킵)`);
        this.events.emit(`done:${taskId}`, "completed");
        return;
      }

      if (taskResult.status === "task-failed") {
        state.status = "failed";
        state.exitCode = 1;
        state.finishedAt = new Date().toISOString();
        updateTaskFileStatus(taskId, "failed");
        cleanupSignals(taskId);
        appendLog(`[task-runner] ${taskId} task 실패`);
        this.events.emit(`done:${taskId}`, "failed");
        return;
      }

      // 2. Review 스킵 여부 확인
      if (shouldSkipReview(taskId)) {
        appendLog(
          `[task-runner] ${taskId} review 스킵 (role 기반) → 바로 merge`,
        );
        await this.doMerge(taskId, state);
        return;
      }

      // 3. Review 실행
      state.phase = "review";
      appendLog(`[task-runner] ${taskId} task 완료 → review 시작`);

      const reviewResult = await runJobReview(taskId, appendLog);

      if (reviewResult.status === "review-approved") {
        await this.doMerge(taskId, state);
      } else {
        state.status = "failed";
        state.exitCode = 1;
        state.finishedAt = new Date().toISOString();
        updateTaskFileStatus(taskId, "failed");
        cleanupSignals(taskId);
        appendLog(`[task-runner] ${taskId} review 수정요청 → 실패 처리`);
        this.events.emit(`done:${taskId}`, "failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      state.status = "failed";
      state.exitCode = 1;
      state.finishedAt = new Date().toISOString();
      updateTaskFileStatus(taskId, "failed");
      appendLog(`[task-runner] ${taskId} 오류: ${msg}`);
      this.events.emit(`done:${taskId}`, "failed");
    }
  }

  private async doMerge(taskId: string, state: TaskRunState): Promise<void> {
    state.phase = "merge";
    const appendLog = (line: string) => {
      state.logs.push(line);
      this.events.emit(`log:${taskId}`, line);
      const logFile = path.join(LOGS_DIR, `${taskId}.log`);
      try {
        fs.appendFileSync(logFile, line + "\n");
      } catch {
        /* ignore */
      }
    };
    appendLog(`[task-runner] ${taskId} review 승인 → merge 시작`);

    const success = await runMergeTask(taskId, appendLog);

    state.finishedAt = new Date().toISOString();
    cleanupSignals(taskId);

    if (success) {
      state.status = "completed";
      state.phase = "done";
      state.exitCode = 0;
      appendLog(`[task-runner] ${taskId} merge 완료 → done`);
      this.events.emit(`done:${taskId}`, "completed");
    } else {
      state.status = "failed";
      state.exitCode = 1;
      updateTaskFileStatus(taskId, "failed");
      appendLog(`[task-runner] ${taskId} merge 실패`);
      this.events.emit(`done:${taskId}`, "failed");
    }
  }

  /** iTerm 모드: iTerm 탭에서 실행 + signal 파일 폴링으로 완료 감지 */
  private runIterm(
    taskId: string,
    state: TaskRunState,
  ): { success: boolean; error?: string } {
    const frontendDir = path.join(PROJECT_ROOT, "src", "frontend");
    const tsxBin = path.join(frontendDir, "node_modules", ".bin", "tsx");
    const taskScript = path.join(frontendDir, "src", "cli", "run-task.ts");
    const logFile = path.join(LOGS_DIR, `${taskId}.log`);

    fs.mkdirSync(LOGS_DIR, { recursive: true });

    const cmd = `cd '${frontendDir}' && PROJECT_ROOT='${PROJECT_ROOT}' '${tsxBin}' '${taskScript}' '${taskId}' 2>&1 | tee '${logFile}'; exit`;
    const opened = runInIterm(`🔧 ${taskId}`, cmd);
    if (!opened) {
      state.logs.push(
        "[task-runner] iTerm2가 실행 중이지 않습니다. 백그라운드로 전환합니다.",
      );
      this.events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);
      return this.runBackground(taskId, state);
    }

    state.logs.push(`[task-runner] ${taskId}: iTerm 탭에서 실행 중`);
    this.events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);

    const dummy = spawn("sleep", ["999999"], {
      stdio: "ignore",
      detached: true,
    });
    dummy.unref();
    this.runs.set(taskId, { state, process: dummy });

    watchItermCompletion(
      taskId,
      state,
      logFile,
      dummy,
      this.events,
      this.watcherMgr,
      (tid, st) => this.handleStartReviewIterm(tid, st),
      (tid, st) => this.startMergeLegacy(tid, st),
    );

    return { success: true };
  }

  /** iTerm review 시작 (watchItermCompletion 콜백용) */
  private handleStartReviewIterm(taskId: string, state: TaskRunState): void {
    startReviewInIterm(
      taskId,
      state,
      this.events,
      this.watcherMgr,
      (tid, st) => this.startReviewLegacy(tid, st),
      (tid, st) => this.startMergeLegacy(tid, st),
    );
  }

  private startReviewLegacy(taskId: string, state: TaskRunState): void {
    state.phase = "review";

    runJobReview(taskId, (line) => {
      state.logs.push(line);
      this.events.emit(`log:${taskId}`, line);
    })
      .then((result) => {
        if (result.status === "review-approved") {
          this.doMerge(taskId, state);
        } else {
          state.status = "failed";
          state.exitCode = 1;
          state.finishedAt = new Date().toISOString();
          updateTaskFileStatus(taskId, "failed");
          cleanupSignals(taskId);
          this.events.emit(`done:${taskId}`, "failed");
        }
      })
      .catch(() => {
        state.status = "failed";
        state.finishedAt = new Date().toISOString();
        this.events.emit(`done:${taskId}`, "failed");
      });
  }

  private startMergeLegacy(taskId: string, state: TaskRunState): void {
    this.doMerge(taskId, state);
  }

  stop(taskId: string): { success: boolean; error?: string } {
    const run = this.runs.get(taskId);
    if (!run || run.state.status !== "running") {
      return { success: false, error: `Task ${taskId} is not running` };
    }

    run.state.logs.push(`[task-runner] Stop requested for ${taskId}`);
    this.watcherMgr.closeWatchers(taskId);

    if (getWorkerMode() === "iterm") {
      killItermTask(taskId);
    }

    // AbortController로 중지
    if (run.abortController) {
      run.abortController.abort();
    }
    // 레거시 프로세스 kill
    if (run.process) {
      killProcessGracefully(run.process);
    }

    run.state.status = "failed";
    run.state.finishedAt = new Date().toISOString();
    updateTaskFileStatus(taskId, "stopped");
    cleanupSignals(taskId);
    this.events.emit(`done:${taskId}`, "failed");

    return { success: true };
  }
}

// Use globalThis to ensure single instance across server.ts and Next.js API routes
const globalKey = "__taskRunnerManager__";
const taskRunnerManager: TaskRunnerManager =
  ((globalThis as Record<string, unknown>)[globalKey] as TaskRunnerManager) ??
  ((globalThis as Record<string, unknown>)[globalKey] =
    new TaskRunnerManager());
export default taskRunnerManager;
