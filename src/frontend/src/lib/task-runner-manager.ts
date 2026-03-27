import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { killProcessGracefully } from "./process-utils";
import { PROJECT_ROOT } from "./paths";
import { TaskRunState } from "./task-runner-types";
import {
  getWorkerMode,
  runInIterm,
  updateTaskFileStatus,
  cleanupSignals,
  killItermTask,
  spawnJobProcess,
  shouldSkipReview,
} from "./task-runner-utils";
import {
  ItermWatcherManager,
  watchItermCompletion,
  startReviewInIterm,
} from "./task-runner-iterm";

export type { TaskRunStatus, TaskRunPhase, TaskRunState } from "./task-runner-types";

class TaskRunnerManager {
  /** Currently running tasks keyed by task ID */
  private runs: Map<string, { state: TaskRunState; process: ChildProcess }> =
    new Map();

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

    const signalDir = path.join(PROJECT_ROOT, ".orchestration", "signals");
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

    state.logs.push(`[task-runner] Starting ${taskId} at ${state.startedAt} (mode: ${workerMode})`);
    updateTaskFileStatus(taskId, "in_progress");

    if (workerMode === "iterm") {
      return this.runIterm(taskId, state, signalDir);
    }
    return this.runBackground(taskId, state, signalDir);
  }

  /** 백그라운드 모드: spawn + exit code 기반 체이닝 */
  private runBackground(taskId: string, state: TaskRunState, signalDir: string): { success: boolean; error?: string } {
    const scriptPath = path.join(PROJECT_ROOT, "scripts", "job-task.sh");

    const proc = spawnJobProcess({
      scriptPath,
      args: [taskId, signalDir],
      taskId,
      state,
      events: this.events,
      label: "task",
      env: { SKIP_SIGNAL: "1" },
      onClose: (code) => {
        state.exitCode = code ?? 1;
        const exitLine = `[task-runner] ${taskId} task exited with code ${code}`;
        state.logs.push(exitLine);
        this.events.emit(`log:${taskId}`, exitLine);

        if (code === 2) {
          // exit 2 = 거절 (rejected) — review 스킵, completed로 처리
          state.status = "completed";
          state.phase = "done";
          state.finishedAt = new Date().toISOString();
          cleanupSignals(taskId);
          const rejectLine = `[task-runner] ${taskId} 거절됨 → 완료 처리 (review 스킵)`;
          state.logs.push(rejectLine);
          this.events.emit(`log:${taskId}`, rejectLine);
          this.events.emit(`done:${taskId}`, "completed");
        } else if (code === 0) {
          if (shouldSkipReview(taskId)) {
            const skipLine = `[task-runner] ${taskId} review 스킵 (role 기반) → 바로 merge`;
            state.logs.push(skipLine);
            this.events.emit(`log:${taskId}`, skipLine);
            this.startMerge(taskId, state);
          } else {
            this.startReview(taskId, state);
          }
        } else {
          state.status = "failed";
          state.finishedAt = new Date().toISOString();
          updateTaskFileStatus(taskId, "failed");
          cleanupSignals(taskId);
          this.events.emit(`done:${taskId}`, "failed");
        }
      },
    });

    if (!proc) {
      state.exitCode = 1;
      return { success: false, error: state.logs[state.logs.length - 1] };
    }

    this.runs.set(taskId, { state, process: proc });
    return { success: true };
  }

  /** iTerm 모드: iTerm 탭에서 실행 + signal 파일 폴링으로 완료 감지 */
  private runIterm(taskId: string, state: TaskRunState, signalDir: string): { success: boolean; error?: string } {
    const scriptPath = path.join(PROJECT_ROOT, "scripts", "job-task.sh");
    const logFile = path.join(PROJECT_ROOT, "output", "logs", `${taskId}.log`);
    const closeScript = path.join(PROJECT_ROOT, "scripts", "lib", "close-iterm-session.sh");

    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const cmd = `bash '${scriptPath}' '${taskId}' '${signalDir}' 2>&1 | tee '${logFile}'; bash '${closeScript}'`;
    const opened = runInIterm(`🔧 ${taskId}`, cmd);
    if (!opened) {
      state.logs.push("[task-runner] iTerm2가 실행 중이지 않습니다. 백그라운드로 전환합니다.");
      this.events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);
      return this.runBackground(taskId, state, signalDir);
    }

    state.logs.push(`[task-runner] ${taskId}: iTerm 탭에서 실행 중`);
    this.events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);

    const dummy = spawn("sleep", ["999999"], { stdio: "ignore", detached: true });
    dummy.unref();
    this.runs.set(taskId, { state, process: dummy });

    watchItermCompletion(
      taskId, state, logFile, signalDir, dummy,
      this.events, this.watcherMgr,
      (tid, st, sd) => this.handleStartReviewIterm(tid, st, sd),
      (tid, st) => this.startMerge(tid, st),
    );

    return { success: true };
  }

  /** iTerm review 시작 (watchItermCompletion 콜백용) */
  private handleStartReviewIterm(taskId: string, state: TaskRunState, signalDir: string): void {
    startReviewInIterm(
      taskId, state, signalDir,
      this.events, this.watcherMgr,
      (tid, st) => this.startReview(tid, st),
      (tid, st) => this.startMerge(tid, st),
    );
  }

  private startReview(taskId: string, state: TaskRunState): void {
    const reviewScript = path.join(PROJECT_ROOT, "scripts", "job-review.sh");
    const signalDir = path.join(PROJECT_ROOT, ".orchestration", "signals");

    state.phase = "review";
    const reviewLine = `[task-runner] ${taskId} task 완료 → review 시작`;
    state.logs.push(reviewLine);
    this.events.emit(`log:${taskId}`, reviewLine);

    const proc = spawnJobProcess({
      scriptPath: reviewScript,
      args: [taskId, signalDir],
      taskId,
      state,
      events: this.events,
      label: "Review",
      env: { SKIP_SIGNAL: "1" },
      onClose: (code) => {
        const exitLine = `[task-runner] ${taskId} review exited with code ${code}`;
        state.logs.push(exitLine);
        this.events.emit(`log:${taskId}`, exitLine);

        if (code === 0) {
          this.startMerge(taskId, state);
        } else {
          state.status = "failed";
          state.exitCode = code ?? 1;
          state.finishedAt = new Date().toISOString();
          updateTaskFileStatus(taskId, "failed");
          cleanupSignals(taskId);
          const failLine = `[task-runner] ${taskId} review 수정요청 → 실패 처리`;
          state.logs.push(failLine);
          this.events.emit(`log:${taskId}`, failLine);
          this.events.emit(`done:${taskId}`, "failed");
        }
      },
    });

    if (!proc) return;
    const run = this.runs.get(taskId);
    if (run) run.process = proc;
  }

  private startMerge(taskId: string, state: TaskRunState): void {
    const mergeScript = path.join(PROJECT_ROOT, "scripts", "lib", "merge-task.sh");

    state.phase = "merge";
    const mergeLine = `[task-runner] ${taskId} review 승인 → merge 시작`;
    state.logs.push(mergeLine);
    this.events.emit(`log:${taskId}`, mergeLine);

    const proc = spawnJobProcess({
      scriptPath: mergeScript,
      args: [taskId],
      taskId,
      state,
      events: this.events,
      label: "Merge",
      onClose: (code) => {
        state.exitCode = code ?? 1;
        state.finishedAt = new Date().toISOString();
        cleanupSignals(taskId);

        if (code === 0) {
          state.status = "completed";
          state.phase = "done";
          const doneLine = `[task-runner] ${taskId} merge 완료 → done`;
          state.logs.push(doneLine);
          this.events.emit(`log:${taskId}`, doneLine);
          this.events.emit(`done:${taskId}`, "completed");
        } else {
          state.status = "failed";
          updateTaskFileStatus(taskId, "failed");
          const failLine = `[task-runner] ${taskId} merge 실패 (exit=${code})`;
          state.logs.push(failLine);
          this.events.emit(`log:${taskId}`, failLine);
          this.events.emit(`done:${taskId}`, "failed");
        }
      },
    });

    if (!proc) return;
    const run = this.runs.get(taskId);
    if (run) run.process = proc;
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

    killProcessGracefully(run.process);

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
  (globalThis as Record<string, unknown>)[globalKey] as TaskRunnerManager ??
  ((globalThis as Record<string, unknown>)[globalKey] = new TaskRunnerManager());
export default taskRunnerManager;
