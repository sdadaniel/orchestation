import type { ChildProcess } from "child_process";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT, SIGNALS_DIR, LOGS_DIR } from "../../lib/paths";
import { TaskRunState } from "./task-runner-types";
import {
  runInIterm,
  updateTaskFileStatus,
  cleanupSignals,
  shouldSkipReview,
} from "./task-runner-utils";

/**
 * Manages fs.watch watchers per task ID.
 * Used by iTerm mode to detect signal files and tail log files.
 */
export class ItermWatcherManager {
  private watchers: Map<string, fs.FSWatcher[]> = new Map();

  /** 해당 태스크의 watcher를 모두 정리 */
  closeWatchers(taskId: string): void {
    const list = this.watchers.get(taskId);
    if (list) {
      for (const w of list) { try { w.close(); } catch { /* ignore */ } }
      this.watchers.delete(taskId);
    }
  }

  /** watcher를 등록 (taskId별 관리) */
  addWatcher(taskId: string, watcher: fs.FSWatcher): void {
    const list = this.watchers.get(taskId) ?? [];
    list.push(watcher);
    this.watchers.set(taskId, list);
  }
}

/** 로그 파일 tail을 fs.watch로 구현 */
export function watchLogFile(
  taskId: string,
  state: TaskRunState,
  logFile: string,
  events: EventEmitter,
  watcherMgr: ItermWatcherManager,
): void {
  let lastSize = 0;

  const readNew = () => {
    try {
      if (!fs.existsSync(logFile)) return;
      const stat = fs.statSync(logFile);
      if (stat.size <= lastSize) return;
      const fd = fs.openSync(logFile, "r");
      const buf = Buffer.alloc(stat.size - lastSize);
      fs.readSync(fd, buf, 0, buf.length, lastSize);
      fs.closeSync(fd);
      lastSize = stat.size;
      for (const line of buf.toString("utf-8").split("\n")) {
        if (line.trim()) {
          state.logs.push(line);
          events.emit(`log:${taskId}`, line);
        }
      }
    } catch { /* ignore */ }
  };

  // 초기 읽기
  readNew();

  try {
    // 로그 디렉토리 확보
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    // 파일이 없으면 빈 파일 생성 (watch 대상 필요)
    if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, "");

    const watcher = fs.watch(logFile, () => readNew());
    watcherMgr.addWatcher(taskId, watcher);
  } catch { /* ignore */ }
}

/** iTerm 모드: signal 디렉토리를 fs.watch로 감시하여 완료 감지 */
export function watchItermCompletion(
  taskId: string,
  state: TaskRunState,
  logFile: string,
  dummy: ChildProcess,
  events: EventEmitter,
  watcherMgr: ItermWatcherManager,
  startReviewIterm: (taskId: string, state: TaskRunState) => void,
  startMergeCallback: (taskId: string, state: TaskRunState) => void,
): void {
  // 기존 watcher 정리
  watcherMgr.closeWatchers(taskId);

  // 로그 파일 감시
  watchLogFile(taskId, state, logFile, events, watcherMgr);

  // signal 디렉토리 감시
  try {
    fs.mkdirSync(SIGNALS_DIR, { recursive: true });

    const watcher = fs.watch(SIGNALS_DIR, (_event, filename) => {
      if (!filename || !filename.startsWith(taskId)) return;
      if (state.status !== "running") return;

      const doneSignal = path.join(SIGNALS_DIR, `${taskId}-task-done`);
      const failedSignal = path.join(SIGNALS_DIR, `${taskId}-task-failed`);
      const rejectedSignal = path.join(SIGNALS_DIR, `${taskId}-task-rejected`);

      if (filename === `${taskId}-task-done` && fs.existsSync(doneSignal)) {
        watcherMgr.closeWatchers(taskId);
        try { fs.unlinkSync(doneSignal); } catch { /* ignore */ }
        try { dummy.kill(); } catch { /* ignore */ }

        if (shouldSkipReview(taskId)) {
          const skipLine = `[task-runner] ${taskId} review 스킵 (role 기반) → 바로 merge`;
          state.logs.push(skipLine);
          events.emit(`log:${taskId}`, skipLine);
          startMergeCallback(taskId, state);
        } else {
          const doneLine = `[task-runner] ${taskId} task 완료 (iTerm) → review 시작`;
          state.logs.push(doneLine);
          events.emit(`log:${taskId}`, doneLine);
          startReviewIterm(taskId, state);
        }

      } else if (filename === `${taskId}-task-rejected` && fs.existsSync(rejectedSignal)) {
        watcherMgr.closeWatchers(taskId);
        try { fs.unlinkSync(rejectedSignal); } catch { /* ignore */ }
        try { dummy.kill(); } catch { /* ignore */ }

        state.status = "completed";
        state.phase = "done";
        state.finishedAt = new Date().toISOString();
        cleanupSignals(taskId);
        const rejectLine = `[task-runner] ${taskId} 거절됨 (iTerm) → 완료 처리 (review 스킵)`;
        state.logs.push(rejectLine);
        events.emit(`log:${taskId}`, rejectLine);
        events.emit(`done:${taskId}`, "completed");

      } else if (filename === `${taskId}-task-failed` && fs.existsSync(failedSignal)) {
        watcherMgr.closeWatchers(taskId);
        try { fs.unlinkSync(failedSignal); } catch { /* ignore */ }
        try { dummy.kill(); } catch { /* ignore */ }

        state.status = "failed";
        state.finishedAt = new Date().toISOString();
        updateTaskFileStatus(taskId, "failed");
        cleanupSignals(taskId);
        const failLine = `[task-runner] ${taskId} task 실패 (iTerm)`;
        state.logs.push(failLine);
        events.emit(`log:${taskId}`, failLine);
        events.emit(`done:${taskId}`, "failed");
      }
    });
    watcherMgr.addWatcher(taskId, watcher);
  } catch { /* ignore */ }
}

/** iTerm 모드: review를 iTerm 탭에서 실행 */
export function startReviewInIterm(
  taskId: string,
  state: TaskRunState,
  events: EventEmitter,
  watcherMgr: ItermWatcherManager,
  startReviewBackground: (taskId: string, state: TaskRunState) => void,
  startMerge: (taskId: string, state: TaskRunState) => void,
): void {
  const frontendDir = path.join(PROJECT_ROOT, "src", "frontend");
  const tsxBin = path.join(frontendDir, "node_modules", ".bin", "tsx");
  const reviewScript = path.join(frontendDir, "src", "cli", "run-review.ts");
  const logFile = path.join(LOGS_DIR, `${taskId}-review.log`);

  state.phase = "review";
  const cmd = `cd '${frontendDir}' && PROJECT_ROOT='${PROJECT_ROOT}' '${tsxBin}' '${reviewScript}' '${taskId}' 2>&1 | tee '${logFile}'; exit`;

  const opened = runInIterm(`🔍 ${taskId} review`, cmd);
  if (!opened) {
    startReviewBackground(taskId, state);
    return;
  }

  state.logs.push(`[task-runner] ${taskId}: iTerm 탭에서 review 실행 중`);
  events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);

  // 로그 파일 감시
  watchLogFile(taskId, state, logFile, events, watcherMgr);

  // signal 디렉토리 감시로 review 완료 감지
  try {
    const watcher = fs.watch(SIGNALS_DIR, (_event, filename) => {
      if (!filename || !filename.startsWith(taskId)) return;
      if (state.status !== "running") return;

      const approvedSignal = path.join(SIGNALS_DIR, `${taskId}-review-approved`);
      const rejectedSignal = path.join(SIGNALS_DIR, `${taskId}-review-rejected`);

      if (filename === `${taskId}-review-approved` && fs.existsSync(approvedSignal)) {
        watcherMgr.closeWatchers(taskId);
        try { fs.unlinkSync(approvedSignal); } catch { /* ignore */ }

        state.logs.push(`[task-runner] ${taskId} review 승인 (iTerm) → merge 시작`);
        events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);
        startMerge(taskId, state);

      } else if (filename === `${taskId}-review-rejected` && fs.existsSync(rejectedSignal)) {
        watcherMgr.closeWatchers(taskId);
        try { fs.unlinkSync(rejectedSignal); } catch { /* ignore */ }

        state.status = "failed";
        state.finishedAt = new Date().toISOString();
        updateTaskFileStatus(taskId, "failed");
        cleanupSignals(taskId);
        state.logs.push(`[task-runner] ${taskId} review 수정요청 (iTerm) → 실패 처리`);
        events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);
        events.emit(`done:${taskId}`, "failed");
      }
    });
    watcherMgr.addWatcher(taskId, watcher);
  } catch { /* ignore */ }
}
