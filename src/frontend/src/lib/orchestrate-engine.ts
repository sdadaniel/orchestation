/**
 * orchestrate-engine.ts
 *
 * orchestrate.sh의 메인 루프를 Node.js로 포팅.
 * Worker(job-task.sh, job-review.sh)는 bash 그대로 유지 (Option B).
 *
 * 개선 사항:
 * - PID 파일 → Map<taskId, ChildProcess> (메모리 관리)
 * - 시그널 파일 → fs.watch 이벤트 기반
 * - process.on("exit") → 자식 일괄 종료
 * - bash 3.x 제약 해소
 */

import { spawn, ChildProcess, execSync } from "child_process";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import http from "http";
import { parseFrontmatter, getString, getStringArray } from "./frontmatter-utils";
import { pipeProcessLogs, killProcessGracefully } from "./process-utils";
import { PROJECT_ROOT, PACKAGE_DIR, TASKS_DIR, OUTPUT_DIR } from "./paths";
import { loadSettings } from "./settings";
import { parseCostLog } from "./cost-parser";
import { syncTaskContentToDb, syncTaskFileToDb } from "./task-db-sync";

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
  process: ChildProcess;
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
const SKIP_REVIEW_ROLES = ["tech-writer"];
const LOOP_INTERVAL_MS = 3000;
const MAX_TASK_COST = 5.0;
const NOTICE_API_HOST = "localhost";
const NOTICE_API_PORT = 3000;

// ── Engine ─────────────────────────────────────────────────

export class OrchestrateEngine extends EventEmitter {
  private workers = new Map<string, WorkerEntry>();
  private retryCounts = new Map<string, number>();
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private signalWatcher: fs.FSWatcher | null = null;
  private _status: EngineStatus = "idle";
  private signalDir: string;
  private baseBranch = "main";
  private maxParallelTask = 2;
  private maxParallelReview = 2;
  private maxReviewRetry = 3;
  private loopCount = 0;

  constructor() {
    super();
    this.setMaxListeners(50);
    this.signalDir = path.join(PROJECT_ROOT, ".orchestration", "signals");
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
    fs.mkdirSync(this.signalDir, { recursive: true });

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
      killProcessGracefully(entry.process);
      this.setTaskStatus(taskId, "stopped");
    }
    this.workers.clear();

    // 루프 중지
    if (this.loopTimer) { clearInterval(this.loopTimer); this.loopTimer = null; }
    if (this.signalWatcher) { this.signalWatcher.close(); this.signalWatcher = null; }

    // 시그널 디렉토리 정리
    try { fs.rmSync(this.signalDir, { recursive: true, force: true }); } catch { /* ignore */ }

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
      const configPath = path.join(PROJECT_ROOT, ".orchestration", "config.json");
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

  private buildTaskInfo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
    taskId: string,
    filePath: string,
    status: TaskStatus,
  ): TaskInfo {
    return {
      id: getString(data, "id", taskId),
      filePath,
      status,
      priority: getString(data, "priority", "medium"),
      branch: getString(data, "branch"),
      worktree: getString(data, "worktree"),
      role: getString(data, "role"),
      reviewerRole: getString(data, "reviewer_role"),
      scope: getStringArray(data, "scope"),
      dependsOn: getStringArray(data, "depends_on"),
      sortOrder: typeof data.sort_order === "number" ? data.sort_order : 0,
      title: getString(data, "title"),
    };
  }

  private scanTasks(): TaskInfo[] {
    const tasks: TaskInfo[] = [];
    if (!fs.existsSync(TASKS_DIR)) return tasks;

    for (const file of fs.readdirSync(TASKS_DIR)) {
      if (!file.endsWith(".md")) continue;
      const idMatch = file.match(/^(TASK-\d+)/);
      if (!idMatch) continue;

      const filePath = path.join(TASKS_DIR, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data } = parseFrontmatter(raw);

      const status = getString(data, "status", "pending") as TaskStatus;
      // 완료/진행 중인 태스크는 조기 제외 (큐 스캔용)
      if (status === "done" || status === "in_progress") continue;

      tasks.push(this.buildTaskInfo(data, idMatch[1], filePath, status));
    }

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
    if (!fs.existsSync(TASKS_DIR)) return null;
    const files = fs.readdirSync(TASKS_DIR).filter(f => f.startsWith(taskId) && f.endsWith(".md"));
    if (files.length === 0) return null;

    const filePath = path.join(TASKS_DIR, files[0]);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data } = parseFrontmatter(raw);
    const status = getString(data, "status", "pending") as TaskStatus;

    return this.buildTaskInfo(data, taskId, filePath, status);
  }

  // ── Dependency & Scope ──────────────────────────────

  private depsSatisfied(task: TaskInfo): boolean {
    if (task.dependsOn.length === 0) return true;
    for (const dep of task.dependsOn) {
      const depInfo = this.readTaskInfo(dep);
      if (!depInfo || depInfo.status !== "done") return false;
    }
    return true;
  }

  private scopeNotConflicting(task: TaskInfo): boolean {
    if (task.scope.length === 0) return true;

    for (const [runningId, _entry] of this.workers) {
      const runningInfo = this.readTaskInfo(runningId);
      if (!runningInfo || runningInfo.scope.length === 0) continue;

      for (const ns of task.scope) {
        for (const rs of runningInfo.scope) {
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
    if (!info) { this.log(`  ❌ ${taskId}: 태스크 파일 없음`); return false; }

    // branch/worktree 자동 추가
    if (!info.branch) {
      const slug = taskId.toLowerCase();
      const raw = fs.readFileSync(info.filePath, "utf-8");
      const updated = raw.replace(
        /^(status: .*)$/m,
        `$1\nbranch: task/${slug}\nworktree: ../repo-wt-${slug}`
      );
      fs.writeFileSync(info.filePath, updated);
      this.log(`  📝 ${taskId}: branch/worktree 필드 자동 추가`);
      info.branch = `task/${slug}`;
      info.worktree = `../repo-wt-${slug}`;
      syncTaskContentToDb(info.filePath, updated);
    }

    // status → in_progress
    this.setTaskStatus(taskId, "in_progress");

    const logFile = path.join(OUTPUT_DIR, "logs", `${taskId}.log`);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const args = [
      path.join(PACKAGE_DIR, "scripts", "job-task.sh"),
      taskId, this.signalDir,
    ];
    if (feedbackFile && fs.existsSync(feedbackFile)) args.push(feedbackFile);

    const env: NodeJS.ProcessEnv = { ...process.env, PACKAGE_DIR, PROJECT_ROOT };
    const settings = loadSettings();
    if (settings.apiKey) env.ANTHROPIC_API_KEY = settings.apiKey;

    const logStream = fs.createWriteStream(logFile);
    const proc = spawn("bash", args, {
      cwd: PROJECT_ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    proc.stdout?.pipe(logStream);
    proc.stderr?.pipe(logStream);

    pipeProcessLogs(proc,
      (line) => this.log(`  [${taskId}] ${line}`),
      (line) => this.parseTaskResult(taskId, line),
    );

    this.workers.set(taskId, { process: proc, taskId, phase: "task", startedAt: Date.now() });
    this.log(`  🔧 ${taskId}: job-task 시작 (PID=${proc.pid})`);

    proc.on("close", (code) => {
      logStream.end();
      this.handleWorkerClose(taskId, "task", code);
    });

    proc.on("error", (err) => {
      this.log(`  ❌ ${taskId}: spawn error: ${err.message}`);
      logStream.end();
    });

    return true;
  }

  private startReview(taskId: string): boolean {
    const logFile = path.join(OUTPUT_DIR, "logs", `${taskId}-review.log`);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const args = [
      path.join(PACKAGE_DIR, "scripts", "job-review.sh"),
      taskId, this.signalDir,
    ];

    const env: NodeJS.ProcessEnv = { ...process.env, PACKAGE_DIR, PROJECT_ROOT };
    const settings = loadSettings();
    if (settings.apiKey) env.ANTHROPIC_API_KEY = settings.apiKey;

    const logStream = fs.createWriteStream(logFile);
    const proc = spawn("bash", args, {
      cwd: PROJECT_ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    proc.stdout?.pipe(logStream);
    proc.stderr?.pipe(logStream);
    pipeProcessLogs(proc, (line) => this.log(`  [${taskId}/review] ${line}`));

    this.workers.set(taskId, { process: proc, taskId, phase: "review", startedAt: Date.now() });
    this.log(`  🔍 ${taskId}: job-review 시작 (PID=${proc.pid})`);

    proc.on("close", (code) => {
      logStream.end();
      this.handleWorkerClose(taskId, "review", code);
    });

    proc.on("error", (err) => {
      this.log(`  ❌ ${taskId}: review spawn error: ${err.message}`);
      logStream.end();
    });

    return true;
  }

  // ── Worker Close → Signal 생성 대기 (bash job이 signal 파일 생성) ──

  private handleWorkerClose(taskId: string, phase: string, code: number | null) {
    // worker가 close되면 signal 파일이 이미 생성되었거나 곧 생성됨
    // 다음 mainLoop에서 signal을 처리
    this.log(`  [${taskId}/${phase}] close (exit=${code})`);
  }

  // ── Signal Processing ───────────────────────────────

  private startSignalWatcher() {
    try {
      this.signalWatcher = fs.watch(this.signalDir, () => {
        // Signal file detected
      });
    } catch {
      // fs.watch 실패 시 polling fallback (mainLoop에서 매번 체크)
    }
  }

  private processSignals() {
    if (!fs.existsSync(this.signalDir)) return;
    const files = fs.readdirSync(this.signalDir);

    for (const file of files) {
      for (const suffix of SIGNAL_TYPES) {
        const match = file.match(new RegExp(`^(TASK-\\d+)-${suffix.replace("-", "\\-")}$`));
        if (match) {
          const taskId = match[1];
          this.handleSignal(taskId, suffix as SignalType);
          // signal 파일 삭제
          try { fs.unlinkSync(path.join(this.signalDir, file)); } catch { /* ignore */ }
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
    const info = this.readTaskInfo(taskId);
    if (!info) return;

    const raw = fs.readFileSync(info.filePath, "utf-8");
    const updated = raw
      .replace(/^status: .*/m, `status: ${newStatus}`)
      .replace(/^updated: .*/m, `updated: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
    fs.writeFileSync(info.filePath, updated);
    syncTaskContentToDb(info.filePath, updated);

    // git add + commit
    try {
      execSync(`git -C "${PROJECT_ROOT}" add -f "${info.filePath}"`, { stdio: "ignore" });
    } catch { /* ignore */ }
  }

  private batchCommit() {
    try {
      const staged = execSync(`git -C "${PROJECT_ROOT}" diff --cached --name-only 2>/dev/null`, { encoding: "utf-8" }).trim();
      if (!staged) return;
      const count = staged.split("\n").filter(f => f.endsWith(".md")).length;
      if (count > 0) {
        execSync(`git -C "${PROJECT_ROOT}" commit -m "chore: 태스크 상태 일괄 업데이트 (${count}건)"`, { stdio: "ignore" });
      }
    } catch { /* ignore */ }
  }

  // ── Merge ───────────────────────────────────────────

  private mergeAndDone(taskId: string) {
    const info = this.readTaskInfo(taskId);
    if (!info) return;

    this.setTaskStatus(taskId, "done");

    if (info.branch) {
      try {
        const hasCommits = execSync(
          `git -C "${PROJECT_ROOT}" log --oneline "${this.baseBranch}..${info.branch}" 2>/dev/null`,
          { encoding: "utf-8" }
        ).trim();

        if (hasCommits) {
          this.log(`  🔀 ${taskId}: ${info.branch} → ${this.baseBranch} 머지`);

          // stash 보호
          let stashed = false;
          try {
            const dirty = execSync(`git -C "${PROJECT_ROOT}" status --porcelain`, { encoding: "utf-8" }).trim();
            if (dirty) {
              execSync(`git -C "${PROJECT_ROOT}" stash push -m "merge-${taskId}" --include-untracked`, { stdio: "ignore" });
              stashed = true;
            }
          } catch { /* ignore */ }

          let mergeFailed = false;
          try {
            execSync(`git -C "${PROJECT_ROOT}" merge "${info.branch}" --no-ff --no-edit`, { stdio: "ignore" });
          } catch {
            // 충돌 → merge-resolver.sh 호출
            this.log(`  ⚠️  ${taskId}: 머지 충돌 → 자동 해결 시도`);
            try {
              execSync(
                `bash "${PACKAGE_DIR}/scripts/lib/merge-resolver.sh" resolve "${PROJECT_ROOT}" "${taskId}" "${info.branch}" "${this.baseBranch}"`,
                { stdio: "ignore" }
              );
            } catch {
              mergeFailed = true;
              try { execSync(`git -C "${PROJECT_ROOT}" merge --abort`, { stdio: "ignore" }); } catch { /* ignore */ }
            }
          }

          // stash 복원
          if (stashed) {
            try { execSync(`git -C "${PROJECT_ROOT}" stash pop`, { stdio: "ignore" }); } catch { /* ignore */ }
          }

          if (mergeFailed) {
            this.markTaskFailed(taskId, "merge conflict");
            return;
          }
        }

        // 브랜치 삭제
        try { execSync(`git -C "${PROJECT_ROOT}" branch -d "${info.branch}"`, { stdio: "ignore" }); } catch { /* ignore */ }
      } catch { /* ignore */ }
    }

    // worktree 정리
    const worktreePath = info.worktree ? path.resolve(PROJECT_ROOT, info.worktree) : null;
    if (worktreePath && fs.existsSync(worktreePath)) {
      try { execSync(`git -C "${PROJECT_ROOT}" worktree remove "${worktreePath}" --force`, { stdio: "ignore" }); } catch { /* ignore */ }
    }

    this.postNotice("info", `${taskId} 완료`, `**${taskId}:** ${info.title}\n\n태스크가 성공적으로 완료되어 ${this.baseBranch}에 머지되었습니다.`);
    this.emit("task-result", { taskId, status: "success" });
    this.log(`  ✅ ${taskId} 완료 → ${this.baseBranch} 머지됨`);
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
      try { execSync(`git -C "${PROJECT_ROOT}" worktree remove "${worktreePath}" --force`, { stdio: "ignore" }); } catch { /* ignore */ }
    }
    if (info.branch) {
      try { execSync(`git -C "${PROJECT_ROOT}" branch -D "${info.branch}"`, { stdio: "ignore" }); } catch { /* ignore */ }
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

    // 배치 git commit
    this.batchCommit();
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
    for (const [taskId, entry] of this.workers) {
      if (entry.process.exitCode !== null || entry.process.killed) {
        this.log(`  ⚠️  ${taskId}: 워커 프로세스 사망 감지`);
        this.workers.delete(taskId);
        // signal 파일이 없으면 failed 처리
        const hasSignal = SIGNAL_TYPES.some(s =>
          fs.existsSync(path.join(this.signalDir, `${taskId}-${s}`))
        );
        if (!hasSignal) {
          this.markTaskFailed(taskId, "워커 프로세스 비정상 종료");
        }
      }
    }
  }

  // ── Zombie Cleanup ──────────────────────────────────

  private cleanupZombies() {
    if (!fs.existsSync(TASKS_DIR)) return;
    let cleaned = 0;

    for (const file of fs.readdirSync(TASKS_DIR)) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(TASKS_DIR, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      if (!raw.includes("status: in_progress")) continue;

      const idMatch = file.match(/^(TASK-\d+)/);
      if (!idMatch) continue;

      // Node engine에서 관리 중이면 건너뛰기
      if (this.workers.has(idMatch[1])) continue;

      fs.writeFileSync(filePath, raw.replace("status: in_progress", "status: stopped"));
      syncTaskFileToDb(filePath);
      cleaned++;
      this.log(`  🧹 zombie: ${idMatch[1]} in_progress → stopped`);
    }

    if (cleaned > 0) this.log(`  🧹 ${cleaned}개 좀비 태스크 정리`);
  }

  // ── Notice ──────────────────────────────────────────

  private postNotice(type: string, title: string, content: string) {
    try {
      const data = JSON.stringify({ title, content, type });
      const req = http.request({
        hostname: NOTICE_API_HOST, port: NOTICE_API_PORT, path: "/api/notices",
        method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      });
      req.write(data);
      req.end();
      req.on("error", () => { /* ignore */ });
    } catch { /* ignore */ }
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
