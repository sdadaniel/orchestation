# Phase 2: Engine 분리 + Shell 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모놀리식 `orchestrate-engine.ts` (618 LOC)를 단일 책임 모듈로 분리, `scripts-legacy/` 완전 삭제

**Architecture:** `orchestrate-engine.ts`에서 (1) 스케줄링 순수 함수들 → `scheduler.ts`, (2) 시그널 처리/상태 전환 → `signal-handler.ts`로 추출. `orchestrate-engine.ts`는 이 모듈들을 연결하는 얇은 조율자로 남습니다. `scripts-legacy/` 삭제 후 `cli.js` 참조 정리.

**Tech Stack:** Node.js, TypeScript, better-sqlite3, EventEmitter

**전제조건:** Phase 1 완료 (TASKS_DIR 제거됨)

---

## File Map

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/frontend/src/engine/scheduler.ts` | Create | `scanTasks`, `depsSatisfied`, `scopeNotConflicting`, `canDispatch`, `taskRowToInfo` |
| `src/frontend/src/engine/signal-handler.ts` | Create | `processSignals`, `handleSignal`, `mergeAndDone`, `markTaskFailed/Rejected`, `cleanupWorktreeAndBranch`, `stopDependents`, `checkCostLimit` |
| `src/frontend/src/engine/orchestrate-engine.ts` | Shrink | 위 두 모듈 사용, ~200 LOC 목표 |
| `scripts-legacy/` | Delete | 전체 삭제 |
| `cli.js` | Verify | shell 직접 호출 없는지 확인 |

---

### Task 1: `scheduler.ts` 생성 — 스케줄링 순수 함수 추출

**Files:**
- Create: `src/frontend/src/engine/scheduler.ts`

- [ ] **Step 1: `scheduler.ts` 파일 생성**

```typescript
/**
 * scheduler.ts
 *
 * 태스크 스케줄링 순수 함수 모음.
 * orchestrate-engine.ts에서 추출. side-effect 없음 (DB read만).
 */
import { execSync } from "child_process";
import { getTasksByStatus, getTask, parseScope, parseDependsOn, type TaskRow } from "../service/task-store";

export type TaskStatus = "pending" | "stopped" | "in_progress" | "reviewing" | "done" | "rejected" | "failed";

export interface TaskInfo {
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

export interface WorkerRef {
  taskId: string;
}

export function taskRowToInfo(row: TaskRow): TaskInfo {
  return {
    id: row.id,
    filePath: "",
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

export function scanTasks(): TaskInfo[] {
  const rows = getTasksByStatus("pending", "stopped");
  const tasks = rows
    .filter(r => r.status !== "done" && r.status !== "in_progress")
    .map(taskRowToInfo);

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

export function depsSatisfied(task: TaskInfo): boolean {
  if (task.dependsOn.length === 0) return true;
  for (const dep of task.dependsOn) {
    const row = getTask(dep);
    if (!row || row.status !== "done") return false;
  }
  return true;
}

export function scopeNotConflicting(
  task: TaskInfo,
  workers: Map<string, WorkerRef>,
  log: (msg: string) => void,
): boolean {
  if (task.scope.length === 0) return true;

  for (const [runningId] of workers) {
    const row = getTask(runningId);
    if (!row) continue;
    const runningScope = parseScope(row);
    if (runningScope.length === 0) continue;

    for (const ns of task.scope) {
      for (const rs of runningScope) {
        if (ns === rs) {
          log(`  ⚠️  ${task.id}: scope 충돌 (${ns}) ← ${runningId} 실행 중`);
          return false;
        }
        const nsBase = ns.replace(/\/\*\*$/, "");
        const rsBase = rs.replace(/\/\*\*$/, "");
        if (nsBase.startsWith(rsBase) || rsBase.startsWith(nsBase)) {
          log(`  ⚠️  ${task.id}: scope 충돌 (${ns} ↔ ${rs}) ← ${runningId} 실행 중`);
          return false;
        }
      }
    }
  }
  return true;
}

export function canDispatch(): boolean {
  try {
    const output = execSync(
      "memory_pressure 2>/dev/null | grep -o 'The system is under .*memory pressure' | awk '{print $6}'",
      { encoding: "utf-8", timeout: 3000 },
    ).trim();
    if (output === "critical" || output.startsWith("warn")) return false;
  } catch { /* non-macOS or command failed */ }
  return true;
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | grep "scheduler" | head -20
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/engine/scheduler.ts
git commit -m "refactor: extract scheduler.ts — task scheduling pure functions"
```

---

### Task 2: `signal-handler.ts` 생성 — 시그널 처리/상태 전환 추출

**Files:**
- Create: `src/frontend/src/engine/signal-handler.ts`

- [ ] **Step 1: `signal-handler.ts` 파일 생성**

```typescript
/**
 * signal-handler.ts
 *
 * 시그널 파일 처리 및 태스크 상태 전환 로직.
 * orchestrate-engine.ts에서 추출.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT, OUTPUT_DIR, SIGNALS_DIR } from "../lib/paths";
import { writeNotice } from "../parser/notice-parser";
import { parseCostLog } from "../parser/cost-parser";
import { getTask, updateTaskStatus, parseScope, type TaskRow } from "../service/task-store";
import { runMergeTask } from "./merge-utils";
import type { TaskInfo } from "./scheduler";
import { taskRowToInfo } from "./scheduler";

export type SignalType =
  | "task-done"
  | "task-failed"
  | "task-rejected"
  | "review-approved"
  | "review-rejected"
  | "stopped";

const SIGNAL_TYPES: SignalType[] = [
  "task-done", "task-failed", "task-rejected",
  "review-approved", "review-rejected", "stopped",
];

const MAX_TASK_COST = 5.0;

export interface SignalHandlerCallbacks {
  log: (msg: string) => void;
  startTask: (taskId: string, feedbackFile?: string) => boolean;
  startReview: (taskId: string) => boolean;
  removeWorker: (taskId: string) => void;
  emitTaskResult: (taskId: string, status: "success" | "failure") => void;
  getRetryCounts: () => Map<string, number>;
  maxReviewRetry: () => number;
  baseBranch: () => string;
}

export function processSignals(cb: SignalHandlerCallbacks): void {
  if (!fs.existsSync(SIGNALS_DIR)) return;
  const files = fs.readdirSync(SIGNALS_DIR);

  for (const file of files) {
    for (const suffix of SIGNAL_TYPES) {
      const match = file.match(new RegExp(`^(TASK-\\d+)-${suffix.replace(/-/g, "\\-")}$`));
      if (match) {
        const taskId = match[1];
        handleSignal(taskId, suffix, cb);
        try { fs.unlinkSync(path.join(SIGNALS_DIR, file)); } catch { /* ignore */ }
      }
    }
  }
}

export function handleSignal(
  taskId: string,
  signal: SignalType,
  cb: SignalHandlerCallbacks,
): void {
  cb.removeWorker(taskId);

  switch (signal) {
    case "stopped":
      cb.log(`  🛑 ${taskId} 중지됨`);
      setTaskStatus(taskId, "stopped", cb.log);
      break;

    case "task-done": {
      const info = readTaskInfo(taskId);
      const role = info?.role ?? "";
      const SKIP_REVIEW_ROLES = ["night-worker", "auto-improve"];
      if (SKIP_REVIEW_ROLES.includes(role)) {
        cb.log(`  ✅ ${taskId} task 완료 → review 스킵 → 머지`);
        mergeAndDone(taskId, cb);
      } else {
        cb.log(`  ✅ ${taskId} task 완료 → review 시작`);
        cb.startReview(taskId);
      }
      break;
    }

    case "task-rejected": {
      cb.log(`  🚫 ${taskId} 거절됨`);
      let reason = "";
      const reasonFile = path.join(OUTPUT_DIR, `${taskId}-rejection-reason.txt`);
      if (fs.existsSync(reasonFile)) reason = fs.readFileSync(reasonFile, "utf-8").split("\n")[0];
      markTaskRejected(taskId, reason, cb.log);
      break;
    }

    case "task-failed":
      cb.log(`  ❌ ${taskId} task 실행 실패`);
      markTaskFailed(taskId, "task 실행 실패", cb);
      break;

    case "review-approved":
      cb.log(`  ✅ ${taskId} review 승인 → 머지`);
      mergeAndDone(taskId, cb);
      break;

    case "review-rejected": {
      if (checkCostLimit(taskId, cb.log)) {
        markTaskFailed(taskId, "비용 상한 초과", cb);
        break;
      }
      const retryCounts = cb.getRetryCounts();
      const count = retryCounts.get(taskId) ?? 0;
      if (count < cb.maxReviewRetry()) {
        retryCounts.set(taskId, count + 1);
        cb.log(`  🔄 ${taskId} review 수정요청 → retry (${count + 1}/${cb.maxReviewRetry()})`);
        const feedbackFile = path.join(OUTPUT_DIR, `${taskId}-review-feedback.txt`);
        cb.startTask(taskId, feedbackFile);
      } else {
        cb.log(`  ❌ ${taskId} retry 상한 초과 (${cb.maxReviewRetry()})`);
        markTaskFailed(taskId, "review retry 상한 초과", cb);
      }
      break;
    }
  }
}

export async function mergeAndDone(taskId: string, cb: SignalHandlerCallbacks): Promise<void> {
  const info = readTaskInfo(taskId);
  if (!info) return;

  const success = await runMergeTask(taskId, (line) => cb.log(`  ${line}`));

  if (success) {
    writeNotice(
      "info",
      `${taskId} 완료`,
      `**${taskId}:** ${info.title}\n\n태스크가 성공적으로 완료되어 ${cb.baseBranch()}에 머지되었습니다.`,
    );
    cb.emitTaskResult(taskId, "success");
    cb.log(`  ✅ ${taskId} 완료 → ${cb.baseBranch()} 머지됨`);
  } else {
    markTaskFailed(taskId, "merge 실패", cb);
  }
}

export function markTaskFailed(taskId: string, reason: string, cb: SignalHandlerCallbacks): void {
  setTaskStatus(taskId, "failed", cb.log);
  cleanupWorktreeAndBranch(taskId, cb.log);
  writeNotice("error", `${taskId} 실패`, `**${taskId}:** ${reason}`);
  stopDependents(taskId, cb.log);
  cb.emitTaskResult(taskId, "failure");
}

export function markTaskRejected(taskId: string, reason: string, log: (msg: string) => void): void {
  setTaskStatus(taskId, "rejected", log);
  cleanupWorktreeAndBranch(taskId, log);
  writeNotice("warning", `${taskId} 거절`, `**${taskId}:** ${reason}`);
}

function checkCostLimit(taskId: string, log: (msg: string) => void): boolean {
  try {
    const costData = parseCostLog();
    let total = 0;
    for (const entry of costData.entries) {
      if (entry.taskId === taskId) total += entry.costUsd;
    }
    if (total > MAX_TASK_COST) {
      log(`  🚨 ${taskId} 비용 상한 초과 ($${total.toFixed(2)} > $${MAX_TASK_COST})`);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

function setTaskStatus(taskId: string, newStatus: string, log: (msg: string) => void): void {
  const row = getTask(taskId);
  if (!row) { log(`  ⚠️  ${taskId}: DB에 없음`); return; }
  updateTaskStatus(taskId, newStatus as Parameters<typeof updateTaskStatus>[1], row.status);
}

function readTaskInfo(taskId: string): TaskInfo | null {
  const row = getTask(taskId);
  if (!row) return null;
  return taskRowToInfo(row);
}

function cleanupWorktreeAndBranch(taskId: string, log: (msg: string) => void): void {
  const info = readTaskInfo(taskId);
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

function stopDependents(failedId: string, log: (msg: string) => void): void {
  const { scanTasks } = require("./scheduler") as typeof import("./scheduler");
  const allTasks = scanTasks();
  for (const task of allTasks) {
    if (task.status !== "pending") continue;
    if (task.dependsOn.includes(failedId)) {
      log(`  ⏸️  ${task.id}: 의존 태스크 ${failedId} 실패 → stopped`);
      setTaskStatus(task.id, "stopped", log);
      stopDependents(task.id, log);
    }
  }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | grep "signal-handler" | head -20
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/engine/signal-handler.ts
git commit -m "refactor: extract signal-handler.ts — signal processing and state transitions"
```

---

### Task 3: `orchestrate-engine.ts` 슬림화

**Files:**
- Modify: `src/frontend/src/engine/orchestrate-engine.ts`

- [ ] **Step 1: orchestrate-engine.ts 전체를 아래 코드로 교체**

```typescript
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
import { PROJECT_ROOT, OUTPUT_DIR, SIGNALS_DIR, CONFIG_PATH } from "../lib/paths";
import { loadSettings } from "../lib/settings";
import { getTask, getTasksByStatus, updateTask, updateTaskStatus } from "../service/task-store";
import { runJobTask } from "./job-task";
import { runJobReview } from "./job-review";
import { SKIP_REVIEW_ROLES } from "./runner/task-runner-utils";
import { scanTasks, depsSatisfied, scopeNotConflicting, canDispatch, type TaskInfo } from "./scheduler";
import { processSignals, type SignalHandlerCallbacks } from "./signal-handler";

export type TaskStatus = "pending" | "stopped" | "in_progress" | "reviewing" | "done" | "rejected" | "failed";
export type EngineStatus = "idle" | "running" | "completed" | "failed";

export interface EngineEvents {
  log: (line: string) => void;
  "status-changed": (status: EngineStatus) => void;
  "task-result": (result: { taskId: string; status: "success" | "failure" }) => void;
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

  constructor() { super(); this.setMaxListeners(50); }

  get status(): EngineStatus { return this._status; }
  get runningCount(): number { return this.workers.size; }

  start(): { success: boolean; error?: string } {
    if (this._status === "running") return { success: false, error: "Already running" };

    this.loadConfig();
    this._status = "running";
    this.retryCounts.clear();
    fs.mkdirSync(SIGNALS_DIR, { recursive: true });
    this.log("🚀 Pipeline 시작 (Node.js engine)");
    this.log(`⚙️  Base Branch: ${this.baseBranchValue}`);
    this.log(`⚙️  Max Parallel: task=${this.maxParallelTask}, review=${this.maxParallelReview}`);
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
    if (this.loopTimer) { clearInterval(this.loopTimer); this.loopTimer = null; }
    if (this.signalWatcher) { this.signalWatcher.close(); this.signalWatcher = null; }
    try { fs.rmSync(SIGNALS_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
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

  private buildSignalCallbacks(): SignalHandlerCallbacks {
    return {
      log: (msg) => this.log(msg),
      startTask: (taskId, feedbackFile) => this.startTask(taskId, feedbackFile),
      startReview: (taskId) => this.startReview(taskId),
      removeWorker: (taskId) => this.workers.delete(taskId),
      emitTaskResult: (taskId, status) => this.emit("task-result", { taskId, status }),
      getRetryCounts: () => this.retryCounts,
      maxReviewRetry: () => this.maxReviewRetryValue,
      baseBranch: () => this.baseBranchValue,
    };
  }

  private startTask(taskId: string, feedbackFile?: string): boolean {
    const row = getTask(taskId);
    if (!row) { this.log(`  ❌ ${taskId}: 태스크 없음`); return false; }

    if (!row.branch) {
      const slug = taskId.toLowerCase();
      updateTask(taskId, { branch: `task/${slug}`, worktree: `../repo-wt-${slug}` });
      this.log(`  📝 ${taskId}: branch/worktree 필드 자동 추가`);
    }

    this.setStatus(taskId, "in_progress");
    const logFile = path.join(OUTPUT_DIR, "logs", `${taskId}.log`);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const abortController = new AbortController();
    const promise = runJobTask(taskId, feedbackFile, (line) => {
      this.log(`  ${line}`);
      try { fs.appendFileSync(logFile, line + "\n"); } catch { /* ignore */ }
    }).then((result) => {
      this.log(`  [${taskId}/task] 완료: ${result.status}`);
    }).catch((err) => {
      this.log(`  ❌ ${taskId}: task 오류: ${err instanceof Error ? err.message : String(err)}`);
    });

    this.workers.set(taskId, { abortController, promise, taskId, phase: "task", startedAt: Date.now() });
    this.log(`  🔧 ${taskId}: job-task 시작`);
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
    this.log(`  🔍 ${taskId}: job-review 시작`);
    return true;
  }

  private startSignalWatcher() {
    try {
      this.signalWatcher = fs.watch(SIGNALS_DIR, () => { /* triggers processSignals on next loop */ });
    } catch { /* polling fallback via mainLoop */ }
  }

  private mainLoop() {
    if (this._status !== "running") return;
    this.loopCount++;
    if (this.loopCount % 10 === 0) this.loadConfig();

    processSignals(this.buildSignalCallbacks());

    const queue = scanTasks().filter(t =>
      (t.status === "pending" || t.status === "stopped") && depsSatisfied(t)
    );

    if (this.workers.size === 0 && queue.length === 0) {
      if (this.loopCount % 5 === 0) this.log("  ⏳ 새 태스크 대기 중...");
      return;
    }

    for (const task of queue) {
      if (this.workers.size >= this.maxParallelTask) break;
      if (this.workers.has(task.id)) continue;
      if (!scopeNotConflicting(task, this.workers, (msg) => this.log(msg))) continue;
      if (!canDispatch()) break;
      this.startTask(task.id);
      this.log(`  📊 슬롯: ${this.workers.size}/${this.maxParallelTask} (대기: ${queue.length})`);
    }

    if (this.loopCount % 10 === 0) this.healthCheck();
  }

  private healthCheck() {
    for (const [taskId, entry] of this.workers) {
      const elapsed = Date.now() - entry.startedAt;
      if (elapsed > 1800000) {
        this.log(`  ⚠️  ${taskId}: 타임아웃 (${Math.round(elapsed / 60000)}분)`);
        entry.abortController.abort();
        this.workers.delete(taskId);
        const { markTaskFailed } = require("./signal-handler") as typeof import("./signal-handler");
        markTaskFailed(taskId, "워커 타임아웃 (30분)", this.buildSignalCallbacks());
      }
    }
  }

  private cleanupZombies() {
    const zombies = getTasksByStatus("in_progress");
    let cleaned = 0;
    for (const row of zombies) {
      if (this.workers.has(row.id)) continue;
      updateTaskStatus(row.id, "stopped", "in_progress");
      cleaned++;
      this.log(`  🧹 zombie: ${row.id} in_progress → stopped`);
    }
    if (cleaned > 0) this.log(`  🧹 ${cleaned}개 좀비 태스크 정리`);
  }

  private setStatus(taskId: string, newStatus: TaskStatus) {
    const row = getTask(taskId);
    if (!row) return;
    updateTaskStatus(taskId, newStatus, row.status);
  }

  private log(line: string) { this.emit("log", line); }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | head -40
```
Expected: 0 errors. 에러 발생 시 타입 불일치를 수정합니다.

- [ ] **Step 3: LOC 확인**

```bash
wc -l src/frontend/src/engine/orchestrate-engine.ts
```
Expected: < 200 lines

- [ ] **Step 4: Commit**

```bash
git add src/frontend/src/engine/orchestrate-engine.ts
git commit -m "refactor: slim orchestrate-engine.ts → delegates to scheduler + signal-handler"
```

---

### Task 4: `scripts-legacy/` 완전 삭제

**Files:**
- Delete: `scripts-legacy/` 디렉토리 전체

- [ ] **Step 1: scripts-legacy 참조가 TypeScript 소스에 없는지 확인**

```bash
grep -r "scripts-legacy" src/frontend/src/ --include="*.ts" --include="*.tsx"
grep -r "scripts-legacy" cli.js
```
Expected: no output

- [ ] **Step 2: cli.js에서 shell 직접 호출 없는지 확인**

```bash
grep -n "\.sh" cli.js
```
Expected: no output

- [ ] **Step 3: scripts-legacy 삭제**

```bash
rm -rf scripts-legacy/
```

- [ ] **Step 4: 빌드 확인**

```bash
cd src/frontend && npx tsc --noEmit && echo "✅ tsc passed"
```
Expected: `✅ tsc passed`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete scripts-legacy/ — fully superseded by TypeScript engine"
```

---

### Task 5: 최종 검증

- [ ] **Step 1: 전체 타입 체크**

```bash
cd src/frontend && npx tsc --noEmit 2>&1
```
Expected: 0 errors

- [ ] **Step 2: engine 파일 LOC 확인**

```bash
wc -l src/frontend/src/engine/orchestrate-engine.ts \
       src/frontend/src/engine/scheduler.ts \
       src/frontend/src/engine/signal-handler.ts
```
Expected: orchestrate-engine.ts < 200, 각 파일 < 200 LOC

- [ ] **Step 3: scripts-legacy 없는지 확인**

```bash
ls scripts-legacy 2>&1
```
Expected: `ls: cannot access 'scripts-legacy': No such file or directory`

- [ ] **Step 4: Commit (변경 없으면 skip)**

```bash
git status
```
