/**
 * orchestrate-engine.ts
 *
 * 오케스트레이션 메인 엔진 (Node.js native).
 * - Map<taskId, WorkerEntry> 기반 워커 관리
 * - 시그널 파일 → fs.watch 이벤트 기반
 * - process.on("exit") → 자식 일괄 종료
 * - SQLite 기반 태스크 저장소 (task-store.ts)
 */

import { execSync } from "child_process";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT, OUTPUT_DIR, SIGNALS_DIR, CONFIG_PATH } from "../lib/paths";
import { writeNotice } from "../parser/notice-parser";
import { loadSettings } from "../lib/settings";
import { parseCostLog } from "../parser/cost-parser";
import {
  getTask,
  getTasksByStatus,
  updateTask,
  updateTaskStatus,
  parseScope,
  parseDependsOn,
  type TaskRow,
} from "../service/task-store";
import { runJobTask } from "./job-task";
import { runJobReview } from "./job-review";
import { runMergeTask } from "./merge-utils";
import { SKIP_REVIEW_ROLES } from "./runner/task-runner-utils";

// ── Types ──────────────────────────────────────────────────

export type TaskStatus = "pending" | "stopped" | "in_progress" | "reviewing" | "done" | "rejected" | "failed";
type SignalType = "task-done" | "task-failed" | "task-rejected" | "review-approved" | "review-rejected" | "stopped";

interface TaskInfo {
  id: string;
  filePath: string;
  status: TaskStatus;
  priority: string;
  branch: string;
  worktree: string;
  role: string;
  reviewerRole: string;
  scope: string[];
  dependsOn: string[];
  sortOrder: number;
  title: string;
}

interface WorkerEntry {
  abortController: AbortController;
  promise: Promise<void>;
  taskId: string;
  phase: "task" | "review";
  startedAt: number;
}

export interface EngineEvents {
  log: (line: string) => void;
  "status-changed": (status: EngineStatus) => void;
  "task-result": (result: { taskId: string; status: "success" | "failure" }) => void;
}

export type EngineStatus = "idle" | "running" | "completed" | "failed";

// ── Constants ──────────────────────────────────────────────

const SIGNAL_TYPES: SignalType[] = [
  "task-done", "task-failed", "task-rejected",
  "review-approved", "review-rejected", "stopped",
];
const LOOP_INTERVAL_MS = 3000;
const MAX_TASK_COST = 5.0;

// ── Engine ─────────────────────────────────────────────────

export class OrchestrateEngine extends EventEmitter {
  private workers = new Map<string, WorkerEntry>();
  private retryCounts = new Map<string, number>();
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private signalWatcher: fs.FSWatcher | null = null;
  private _status: EngineStatus = "idle";
  private baseBranch = "main";
  private maxParallelTask = 2;
  private maxParallelReview = 2;
  private maxReviewRetry = 3;
  private loopCount = 0;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  // ── Public API ──────────────────────────────────────

  get status(): EngineStatus { return this._status; }
  get runningCount(): number { return this.workers.size; }

  start(): { success: boolean; error?: string } {
    if (this._status === "running") {
      return { success: false, error: "Already running" };
    }

    this.loadConfig();
    this._status = "running";
    this.retryCounts.clear();

    // 시그널 디렉토리 생성
    fs.mkdirSync(SIGNALS_DIR, { recursive: true });

    this.log("🚀 Pipeline 시작 (Node.js engine)");
    this.log(`⚙️  Base Branch: ${this.baseBranch}`);
    this.log(`⚙️  Max Parallel: task=${this.maxParallelTask}, review=${this.maxParallelReview}`);
    this.emit("status-changed", this._status);

    // 좀비 태스크 정리
    this.cleanupZombies();

    // 시그널 감시 시작 (fs.watch)
    this.startSignalWatcher();

    // 메인 루프
    this.loopTimer = setInterval(() => this.mainLoop(), LOOP_INTERVAL_MS);
    // 즉시 1회 실행
    this.mainLoop();

    return { success: true };
  }

  stop(): { success: boolean } {
    this.log("🛑 Pipeline 종료 요청");

    // 모든 워커 종료
    for (const [taskId, entry] of this.workers) {
      this.log(`  🛑 ${taskId}: 워커 종료`);
      entry.abortController.abort();
      this.setTaskStatus(taskId, "stopped");
    }
    this.workers.clear();

    // 루프 중지
    if (this.loopTimer) { clearInterval(this.loopTimer); this.loopTimer = null; }
    if (this.signalWatcher) { this.signalWatcher.close(); this.signalWatcher = null; }

    // 시그널 디렉토리 정리
    try { fs.rmSync(SIGNALS_DIR, { recursive: true, force: true }); } catch { /* ignore */ }

    this._status = "failed";
    this.log("🛑 Pipeline 종료 완료");
    this.emit("status-changed", this._status);
    return { success: true };
  }

  // ── Config ──────────────────────────────────────────

  private loadConfig() {
    const settings = loadSettings();
    this.baseBranch = settings.baseBranch;
    this.maxReviewRetry = settings.maxReviewRetry;

    // maxParallel 분리: config.json에서 task/review 별도 설정
    try {
      const configPath = CONFIG_PATH;
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        this.maxParallelTask = cfg.maxParallel?.task ?? settings.maxParallel;
        this.maxParallelReview = cfg.maxParallel?.review ?? settings.maxParallel;
      } else {
        this.maxParallelTask = settings.maxParallel;
        this.maxParallelReview = settings.maxParallel;
      }
    } catch {
      this.maxParallelTask = settings.maxParallel;
      this.maxParallelReview = settings.maxParallel;
    }
  }

  // ── Task Scanning ───────────────────────────────────

  private taskRowToInfo(row: TaskRow): TaskInfo {
    return {
      id: row.id,
      filePath: "",  // no longer file-based
      status: row.status as TaskStatus,
      priority: row.priority || "medium",
      branch: row.branch || "",
      worktree: row.worktree || "",
      role: row.role || "",
      reviewerRole: row.reviewer_role || "",
      scope: parseScope(row),
      dependsOn: parseDependsOn(row),
      sortOrder: row.sort_order || 0,
      title: row.title || "",
    };
  }

  private scanTasks(): TaskInfo[] {
    const rows = getTasksByStatus("pending", "stopped");
    const tasks = rows
      .filter(r => r.status !== "done" && r.status !== "in_progress")
      .map(r => this.taskRowToInfo(r));

    // 정렬: stopped > pending, high > medium > low, sortOrder, id
    const statusWeight = (s: string) => s === "stopped" ? 0 : 1;
    const priorityWeight = (p: string) => ({ high: 1, medium: 2, low: 3 }[p] ?? 4);

    tasks.sort((a, b) =>
      statusWeight(a.status) - statusWeight(b.status) ||
      priorityWeight(a.priority) - priorityWeight(b.priority) ||
      a.sortOrder - b.sortOrder ||
      a.id.localeCompare(b.id)
    );

    return tasks;
  }

  private readTaskInfo(taskId: string): TaskInfo | null {
    const row = getTask(taskId);
    if (!row) return null;
    return this.taskRowToInfo(row);
  }

  // ── Dependency & Scope ──────────────────────────────

  private depsSatisfied(task: TaskInfo): boolean {
    if (task.dependsOn.length === 0) return true;
    for (const dep of task.dependsOn) {
      const row = getTask(dep);
      if (!row || row.status !== "done") return false;
    }
    return true;
  }

  private scopeNotConflicting(task: TaskInfo): boolean {
    if (task.scope.length === 0) return true;

    for (const [runningId, _entry] of this.workers) {
      const row = getTask(runningId);
      if (!row) continue;
      const runningScope = parseScope(row);
      if (runningScope.length === 0) continue;

      for (const ns of task.scope) {
        for (const rs of runningScope) {
          if (ns === rs) {
            this.log(`  ⚠️  ${task.id}: scope 충돌 (${ns}) ← ${runningId} 실행 중`);
            return false;
          }
          const nsBase = ns.replace(/\/\*\*$/, "");
          const rsBase = rs.replace(/\/\*\*$/, "");
          if (nsBase.startsWith(rsBase) || rsBase.startsWith(nsBase)) {
            this.log(`  ⚠️  ${task.id}: scope 충돌 (${ns} ↔ ${rs}) ← ${runningId} 실행 중`);
            return false;
          }
        }
      }
    }
    return true;
  }

  // ── Worker Spawn ────────────────────────────────────

  private startTask(taskId: string, feedbackFile?: string): boolean {
    const info = this.readTaskInfo(taskId);
    if (!info) { this.log(`  ❌ ${taskId}: 태스크 없음`); return false; }

    // branch/worktree 자동 추가
    if (!info.branch) {
      const slug = taskId.toLowerCase();
      const branch = `task/${slug}`;
      const worktree = `../repo-wt-${slug}`;
      updateTask(taskId, { branch, worktree });
      this.log(`  📝 ${taskId}: branch/worktree 필드 자동 추가`);
      info.branch = branch;
      info.worktree = worktree;
    }

    // status → in_progress
    this.setTaskStatus(taskId, "in_progress");

    // 로그 파일 생성 (Terminal/로그 탭에서 watch)
    const logFile = path.join(OUTPUT_DIR, "logs", `${taskId}.log`);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const abortController = new AbortController();

    const promise = runJobTask(taskId, feedbackFile, (line) => {
      this.log(`  ${line}`);
      // 로그 파일에도 기록 (UI Terminal/로그 탭에서 file watch)
      try { fs.appendFileSync(logFile, line + "\n"); } catch { /* ignore */ }
    }).then((result) => {
      this.log(`  [${taskId}/task] 완료: ${result.status}`);
    }).catch((err) => {
      this.log(`  ❌ ${taskId}: task 오류: ${err instanceof Error ? err.message : String(err)}`);
    });

    this.workers.set(taskId, { abortController, promise, taskId, phase: "task", startedAt: Date.now() });
    this.log(`  🔧 ${taskId}: job-task 시작 (Node.js native)`);

    return true;
  }

  private startReview(taskId: string): boolean {
    const logFile = path.join(OUTPUT_DIR, "logs", `${taskId}-review.log`);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const abortController = new AbortController();

    const promise = runJobReview(taskId, (line) => {
      this.log(`  ${line}`);
      try { fs.appendFileSync(logFile, line + "\n"); } catch { /* ignore */ }
    }).then((result) => {
      this.log(`  [${taskId}/review] 완료: ${result.status}`);
    }).catch((err) => {
      this.log(`  ❌ ${taskId}: review 오류: ${err instanceof Error ? err.message : String(err)}`);
    });

    this.workers.set(taskId, { abortController, promise, taskId, phase: "review", startedAt: Date.now() });
    this.log(`  🔍 ${taskId}: job-review 시작 (Node.js native)`);

    return true;
  }

  // Worker Close 핸들러는 Node.js native 모드에서는 불필요
  // 시그널은 runJobTask/runJobReview 내부에서 직접 생성됨

  // ── Signal Processing ───────────────────────────────

  private startSignalWatcher() {
    try {
      this.signalWatcher = fs.watch(SIGNALS_DIR, () => {
        // Signal file detected
      });
    } catch {
      // fs.watch 실패 시 polling fallback (mainLoop에서 매번 체크)
    }
  }

  private processSignals() {
    if (!fs.existsSync(SIGNALS_DIR)) return;
    const files = fs.readdirSync(SIGNALS_DIR);

    for (const file of files) {
      for (const suffix of SIGNAL_TYPES) {
        const match = file.match(new RegExp(`^(TASK-\\d+)-${suffix.replace("-", "\\-")}$`));
        if (match) {
          const taskId = match[1];
          this.handleSignal(taskId, suffix as SignalType);
          // signal 파일 삭제
          try { fs.unlinkSync(path.join(SIGNALS_DIR, file)); } catch { /* ignore */ }
        }
      }
    }
  }

  private handleSignal(taskId: string, signal: SignalType) {
    // 워커 Map에서 제거 (프로세스는 이미 close됨)
    this.workers.delete(taskId);

    switch (signal) {
      case "stopped":
        this.log(`  🛑 ${taskId} 중지됨`);
        this.setTaskStatus(taskId, "stopped");
        break;

      case "task-done": {
        const info = this.readTaskInfo(taskId);
        const role = info?.role ?? "";
        if (SKIP_REVIEW_ROLES.includes(role)) {
          this.log(`  ✅ ${taskId} task 완료 → review 스킵 → 머지`);
          this.mergeAndDone(taskId);
        } else {
          this.log(`  ✅ ${taskId} task 완료 → review 시작`);
          this.startReview(taskId);
        }
        break;
      }

      case "task-rejected": {
        this.log(`  🚫 ${taskId} 거절됨`);
        let reason = "";
        const reasonFile = path.join(OUTPUT_DIR, `${taskId}-rejection-reason.txt`);
        if (fs.existsSync(reasonFile)) reason = fs.readFileSync(reasonFile, "utf-8").split("\n")[0];
        this.markTaskRejected(taskId, reason);
        break;
      }

      case "task-failed":
        this.log(`  ❌ ${taskId} task 실행 실패`);
        this.markTaskFailed(taskId, "task 실행 실패");
        break;

      case "review-approved":
        this.log(`  ✅ ${taskId} review 승인 → 머지`);
        this.mergeAndDone(taskId);
        break;

      case "review-rejected": {
        // 비용 circuit breaker
        if (this.checkCostLimit(taskId)) {
          this.markTaskFailed(taskId, "비용 상한 초과");
          break;
        }

        const count = this.retryCounts.get(taskId) ?? 0;
        if (count < this.maxReviewRetry) {
          this.retryCounts.set(taskId, count + 1);
          this.log(`  🔄 ${taskId} review 수정요청 → retry (${count + 1}/${this.maxReviewRetry})`);
          const feedbackFile = path.join(OUTPUT_DIR, `${taskId}-review-feedback.txt`);
          this.startTask(taskId, feedbackFile);
        } else {
          this.log(`  ❌ ${taskId} retry 상한 초과 (${this.maxReviewRetry})`);
          this.markTaskFailed(taskId, "review retry 상한 초과");
        }
        break;
      }
    }
  }

  private checkCostLimit(taskId: string): boolean {
    try {
      const costData = parseCostLog();
      let total = 0;
      for (const entry of costData.entries) {
        if (entry.taskId === taskId) total += entry.costUsd;
      }
      if (total > MAX_TASK_COST) {
        this.log(`  🚨 ${taskId} 비용 상한 초과 ($${total.toFixed(2)} > $${MAX_TASK_COST})`);
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  // ── Status Management ───────────────────────────────

  private setTaskStatus(taskId: string, newStatus: TaskStatus) {
    const row = getTask(taskId);
    if (!row) return;
    updateTaskStatus(taskId, newStatus, row.status);
  }

  // ── Merge ───────────────────────────────────────────

  private async mergeAndDone(taskId: string) {
    const info = this.readTaskInfo(taskId);
    if (!info) return;

    const success = await runMergeTask(taskId, (line) => this.log(`  ${line}`));

    if (success) {
      this.postNotice("info", `${taskId} 완료`, `**${taskId}:** ${info.title}\n\n태스크가 성공적으로 완료되어 ${this.baseBranch}에 머지되었습니다.`);
      this.emit("task-result", { taskId, status: "success" });
      this.log(`  ✅ ${taskId} 완료 → ${this.baseBranch} 머지됨`);
    } else {
      this.markTaskFailed(taskId, "merge 실패");
    }
  }

  // ── Failure/Rejection ───────────────────────────────

  private markTaskFailed(taskId: string, reason: string) {
    this.setTaskStatus(taskId, "failed");
    this.cleanupWorktreeAndBranch(taskId);
    this.postNotice("error", `${taskId} 실패`, `**${taskId}:** ${reason}`);
    this.stopDependents(taskId);
    this.emit("task-result", { taskId, status: "failure" });
  }

  private markTaskRejected(taskId: string, reason: string) {
    this.setTaskStatus(taskId, "rejected");
    this.cleanupWorktreeAndBranch(taskId);
    this.postNotice("warning", `${taskId} 거절`, `**${taskId}:** ${reason}`);
  }

  private cleanupWorktreeAndBranch(taskId: string) {
    const info = this.readTaskInfo(taskId);
    if (!info) return;
    const worktreePath = info.worktree ? path.resolve(PROJECT_ROOT, info.worktree) : null;
    if (worktreePath && fs.existsSync(worktreePath)) {
      try {
        execSync(`git -C "${PROJECT_ROOT}" worktree remove "${worktreePath}" --force`, { stdio: "ignore" });
      } catch { /* ignore */ }
    }
    if (info.branch) {
      try {
        execSync(`git -C "${PROJECT_ROOT}" branch -D "${info.branch}"`, { stdio: "ignore" });
      } catch { /* ignore */ }
    }
  }

  private stopDependents(failedId: string) {
    const allTasks = this.scanTasks();
    for (const task of allTasks) {
      if (task.status !== "pending") continue;
      if (task.dependsOn.includes(failedId)) {
        this.log(`  ⏸️  ${task.id}: 의존 태스크 ${failedId} 실패 → stopped`);
        this.setTaskStatus(task.id, "stopped");
        this.stopDependents(task.id);
      }
    }
  }

  // ── Main Loop ───────────────────────────────────────

  private mainLoop() {
    if (this._status !== "running") return;

    this.loopCount++;

    // config 핫 리로드 (10회마다)
    if (this.loopCount % 10 === 0) this.loadConfig();

    // 시그널 처리
    this.processSignals();

    // 실행 가능한 태스크 큐
    const queue = this.scanTasks().filter(t =>
      (t.status === "pending" || t.status === "stopped") && this.depsSatisfied(t)
    );

    // 실행 중인 것도 없고 대기 큐도 비면 대기
    if (this.workers.size === 0 && queue.length === 0) {
      if (this.loopCount % 5 === 0) this.log("  ⏳ 새 태스크 대기 중...");
      return;
    }

    // 빈 슬롯에 새 태스크 투입
    for (const task of queue) {
      if (this.workers.size >= this.maxParallelTask) break;
      if (this.workers.has(task.id)) continue;
      if (!this.scopeNotConflicting(task)) continue;
      if (!this.canDispatch()) break;

      this.startTask(task.id);
      this.log(`  📊 슬롯: ${this.workers.size}/${this.maxParallelTask} (대기: ${queue.length})`);
    }

    // health check (10회마다)
    if (this.loopCount % 10 === 0) this.healthCheck();
  }

  // ── Guards ──────────────────────────────────────────

  private canDispatch(): boolean {
    // 시스템 메모리 체크 (macOS)
    try {
      const output = execSync("memory_pressure 2>/dev/null | grep -o 'The system is under .*memory pressure' | awk '{print $6}'", {
        encoding: "utf-8",
        timeout: 3000,
      }).trim();
      if (output === "critical" || output.startsWith("warn")) {
        this.log("  🚨 메모리 압박 → 대기");
        return false;
      }
    } catch { /* ignore - non-macOS or command failed */ }
    return true;
  }

  // ── Health Check ────────────────────────────────────

  private healthCheck() {
    // Node.js native 워커는 Promise 기반이므로 프로세스 사망 체크 불필요
    // 시그널 기반으로 상태 확인
    for (const [taskId, entry] of this.workers) {
      const elapsed = Date.now() - entry.startedAt;
      // 30분 타임아웃
      if (elapsed > 1800000) {
        this.log(`  ⚠️  ${taskId}: 타임아웃 (${Math.round(elapsed / 60000)}분)`);
        entry.abortController.abort();
        this.workers.delete(taskId);
        this.markTaskFailed(taskId, "워커 타임아웃 (30분)");
      }
    }
  }

  // ── Zombie Cleanup ──────────────────────────────────

  private cleanupZombies() {
    const zombies = getTasksByStatus("in_progress");
    let cleaned = 0;

    for (const row of zombies) {
      // Node engine에서 관리 중이면 건너뛰기
      if (this.workers.has(row.id)) continue;

      updateTaskStatus(row.id, "stopped", "in_progress");
      cleaned++;
      this.log(`  🧹 zombie: ${row.id} in_progress → stopped`);
    }

    if (cleaned > 0) this.log(`  🧹 ${cleaned}개 좀비 태스크 정리`);
  }

  // ── Notice ──────────────────────────────────────────

  private postNotice(type: string, title: string, content: string) {
    writeNotice(type as "info" | "warning" | "error" | "request", title, content);
  }

  // ── Logging ─────────────────────────────────────────

  private log(line: string) {
    this.emit("log", line);
  }

  private parseTaskResult(taskId: string, line: string) {
    if (line.match(/[✅✓]/)) {
      this.emit("task-result", { taskId, status: "success" });
    } else if (line.match(/[❌✗✘]/)) {
      this.emit("task-result", { taskId, status: "failure" });
    }
  }
}
