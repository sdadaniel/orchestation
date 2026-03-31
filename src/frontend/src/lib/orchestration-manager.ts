import { spawn, ChildProcess, execSync } from "child_process";
import { EventEmitter } from "events";
import path from "path";
import fs from "fs";
import { appendRunHistory, type RunHistoryEntry } from "./run-history";
import { parseCostLog } from "./cost-parser";
import { getErrorMessage } from "./error-utils";
import { loadSettings } from "./settings";
import { pipeProcessLogs, killProcessGracefully } from "./process-utils";

/** 프로젝트별 /tmp/ 경로 prefix (orchestrate.sh와 동일한 해시 사용) */
function getTmpPrefix(): string {
  const projRoot = process.env.PROJECT_ROOT || path.resolve(process.cwd(), "..", "..");
  try {
    const hash = execSync(`echo "${projRoot}" | cksum | awk '{print $1}'`).toString().trim();
    return `/tmp/orchestrate-${hash}`;
  } catch {
    return "/tmp/orchestrate-default";
  }
}

export type OrchestrationStatus = "idle" | "running" | "completed" | "failed";

export interface OrchestrationStatusData {
  status: OrchestrationStatus;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  taskResults: { taskId: string; status: "success" | "failure" }[];
}

export interface TaskResult {
  taskId: string;
  status: "success" | "failure";
}

export interface OrchestrationState {
  status: OrchestrationStatus;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  taskResults: TaskResult[];
  exitCode: number | null;
}

class OrchestrationManager {
  private process: ChildProcess | null = null;
  private pid: number | null = null;        // OS PID — source of truth
  private currentRunId = 0;                  // 세대 관리 — stale 콜백 무시
  private launching = false;

  /** SSE 클라이언트에게 상태 변경을 알리기 위한 이벤트 버스 */
  public readonly events = new EventEmitter();

  private state: OrchestrationState = {
    status: "idle",
    startedAt: null,
    finishedAt: null,
    logs: [],
    taskResults: [],
    exitCode: null,
  };

  constructor() {
    this.events.setMaxListeners(50); // SSE 클라이언트 수만큼
    // 서버 시작 직후 요청과의 타이밍 충돌 방지를 위해 지연 실행
    setTimeout(() => this.cleanupZombies(), 3000);
  }

  /** 상태 변경 시 SSE 클라이언트에 알림 */
  private emitStatusChange() {
    const state = this.getState();
    this.events.emit("status-changed", {
      status: state.status,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      exitCode: state.exitCode,
      taskResults: state.taskResults,
    });
  }

  // ── Source of Truth: OS 프로세스 생존 여부 ──────────────

  /**
   * 상태를 읽을 때마다 OS 실제 상태와 동기화.
   * this.state.status가 아니라 "PID가 살아있는가"가 진실.
   */
  private reconcileStateWithOS() {
    if (this.state.status !== "running" || this.launching) return;

    // 1) PID가 있으면 OS 레벨 생존 확인
    if (this.pid) {
      try {
        process.kill(this.pid, 0); // signal 0 = 생존 확인만
        return; // 살아있음 → running 유지
      } catch {
        // ESRCH = 프로세스 없음 → 죽었는데 Node.js가 모르는 상태
        this.handleProcessDeath("OS 레벨에서 프로세스 사라짐 (pid=" + this.pid + ")");
        return;
      }
    }

    // 2) PID 없으면 running일 수 없음
    if (!this.process) {
      this.handleProcessDeath("process 객체 없음, pid 없음");
      return;
    }

    // 3) process 객체는 있는데 PID가 없는 비정상 상태
    if (this.process.exitCode !== null || this.process.killed) {
      this.handleProcessDeath("process.exitCode/killed 감지");
    }
  }

  /**
   * 프로세스 종료 통합 처리.
   * 어디서 호출되든 동일한 종료 로직.
   */
  private handleProcessDeath(reason: string) {
    if (this.state.status !== "running" && this.state.status !== "idle") return; // 이미 종료됨
    this.appendLog(`[orchestrate] 프로세스 종료 감지: ${reason}`);
    this.state.status = "failed";
    this.state.finishedAt = this.state.finishedAt ?? new Date().toISOString();
    this.state.exitCode = this.state.exitCode ?? 1;
    this.process = null;
    this.pid = null;
    this.saveRunHistory();
    this.emitStatusChange();
  }

  // ── Public API ─────────────────────────────────────────

  getState(): OrchestrationState {
    this.reconcileStateWithOS();
    return { ...this.state, logs: [...this.state.logs], taskResults: [...this.state.taskResults] };
  }

  getStatus(): OrchestrationStatus {
    this.reconcileStateWithOS();
    return this.state.status;
  }

  getLogs(since: number = 0): string[] {
    return this.state.logs.slice(since);
  }

  isRunning(): boolean {
    return this.getStatus() === "running";
  }

  // ── Run ────────────────────────────────────────────────

  run(): { success: boolean; error?: string } {
    if (this.isRunning() || this.launching) {
      return { success: false, error: "Orchestration is already running" };
    }

    // lock 파일 + PID 생존으로 중복 체크
    const lockPidFile = `${getTmpPrefix()}/lock/pid`;
    if (fs.existsSync(lockPidFile)) {
      try {
        const lockPid = parseInt(fs.readFileSync(lockPidFile, "utf-8").trim(), 10);
        if (!isNaN(lockPid)) {
          process.kill(lockPid, 0); // 살아있는지 확인
          return { success: false, error: "orchestrate.sh가 이미 실행 중입니다" };
        }
      } catch {
        // 죽어있음 → lock 제거
        fs.rmSync(`${getTmpPrefix()}/lock`, { recursive: true, force: true });
      }
    }

    this.launching = true;
    const runId = ++this.currentRunId;

    const projectRoot = process.env.PROJECT_ROOT || path.resolve(process.cwd(), "..", "..");
    const packageDir = process.env.PACKAGE_DIR || projectRoot;
    const scriptPath = path.join(packageDir, "scripts", "orchestrate.sh");

    // 상태 리셋
    this.state = {
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logs: [],
      taskResults: [],
      exitCode: null,
    };

    this.appendLog(`[orchestrate] Starting orchestrate.sh (runId=${runId})`);
    this.appendLog(`[orchestrate] Script: ${scriptPath}`);
    this.appendLog(`[orchestrate] CWD: ${projectRoot}`);

    const settings = loadSettings();

    try {
      this.process = spawn("bash", [scriptPath], {
        cwd: projectRoot,
        env: {
          ...process.env,
          PACKAGE_DIR: packageDir,
          PROJECT_ROOT: projectRoot,
          MAX_PARALLEL: String(settings.maxParallel),
          BASE_BRANCH: settings.baseBranch,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      const msg = getErrorMessage(err, String(err));
      this.appendLog(`[orchestrate] Failed to spawn: ${msg}`);
      this.state.status = "failed";
      this.state.finishedAt = new Date().toISOString();
      this.state.exitCode = 1;
      this.process = null;
      this.pid = null;
      this.launching = false;
      return { success: false, error: msg };
    }

    this.pid = this.process.pid ?? null;
    this.launching = false;
    const proc = this.process;

    this.appendLog(`[orchestrate] PID: ${this.pid}`);
    this.emitStatusChange();

    pipeProcessLogs(proc, (line) => this.appendLog(line), (line) => this.parseTaskResult(line));

    // close 콜백: runId로 stale 콜백 무시
    proc.on("close", (code: number | null, signal: string | null) => {
      if (runId !== this.currentRunId) return; // 오래된 콜백 무시
      this.state.exitCode = code ?? (signal ? 128 : 1);
      this.state.status = code === 0 ? "completed" : "failed";
      this.state.finishedAt = new Date().toISOString();
      this.appendLog(`[orchestrate] Process exited code=${code} signal=${signal}`);
      this.process = null;
      this.pid = null;
      this.saveRunHistory();
      this.emitStatusChange();
    });

    proc.on("error", (err: Error) => {
      if (runId !== this.currentRunId) return;
      this.appendLog(`[orchestrate] Process error: ${err.message}`);
      this.state.status = "failed";
      this.state.finishedAt = new Date().toISOString();
      this.process = null;
      this.pid = null;
      this.emitStatusChange();
    });

    return { success: true };
  }

  // ── Stop ───────────────────────────────────────────────

  stop(): { success: boolean; error?: string } {
    this.appendLog("[orchestrate] Stop — 즉시 전체 종료");

    // runId 증가 → 진행 중인 close 콜백이 도착해도 무시
    this.currentRunId++;

    // 1) orchestrate.sh kill
    if (this.process) {
      killProcessGracefully(this.process);
    }
    if (this.pid) {
      try { process.kill(this.pid, "SIGTERM"); } catch { /* ignore */ }
      const killPid = this.pid;
      setTimeout(() => { try { process.kill(killPid, "SIGKILL"); } catch { /* ignore */ } }, 2000);
    }
    // lock PID로도 kill
    const lockPidFile = `${getTmpPrefix()}/lock/pid`;
    if (fs.existsSync(lockPidFile)) {
      try {
        const lockPid = parseInt(fs.readFileSync(lockPidFile, "utf-8").trim(), 10);
        if (!isNaN(lockPid)) {
          try { process.kill(lockPid, "SIGTERM"); } catch { /* ignore */ }
          setTimeout(() => { try { process.kill(lockPid, "SIGKILL"); } catch { /* ignore */ } }, 2000);
        }
      } catch { /* ignore */ }
    }

    // 2) 모든 워커 kill — PID 파일 기반
    try {
      const tmpFiles = fs.readdirSync("/tmp").filter((f) => /^worker-TASK-\w+\.pid$/.test(f));
      for (const pf of tmpFiles) {
        const workerPid = parseInt(fs.readFileSync(`/tmp/${pf}`, "utf-8").trim(), 10);
        if (!isNaN(workerPid)) {
          try { process.kill(workerPid, "SIGKILL"); } catch { /* ignore */ }
        }
        try { fs.unlinkSync(`/tmp/${pf}`); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    try { execSync('pkill -9 -f "claude.*--dangerously-skip-permissions" 2>/dev/null || true', { stdio: "ignore" }); } catch { /* ignore */ }

    // 3) in_progress → stopped
    this.markAllInProgressAsStopped();

    // 4) lock/signal/PID 정리
    const _tmpPfx = getTmpPrefix();
    try { fs.rmSync(`${_tmpPfx}/lock`, { recursive: true, force: true }); } catch { /* ignore */ }
    try { fs.rmSync(`${_tmpPfx}/retry`, { recursive: true, force: true }); } catch { /* ignore */ }

    // 5) 상태 즉시 반영
    this.state.status = "failed";
    this.state.exitCode = 130;
    this.state.finishedAt = new Date().toISOString();
    this.process = null;
    this.pid = null;
    this.saveRunHistory();

    this.appendLog("[orchestrate] 전체 종료 완료");
    this.emitStatusChange();
    return { success: true };
  }

  // ── Internal ───────────────────────────────────────────

  private markAllInProgressAsStopped() {
    try {
      const projectRoot = path.resolve(process.cwd(), "..", "..");
      const tasksDir = path.join(projectRoot, ".orchestration", "tasks");
      if (!fs.existsSync(tasksDir)) return;

      const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const filePath = path.join(tasksDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.includes("status: in_progress")) {
          fs.writeFileSync(filePath, content.replace("status: in_progress", "status: stopped"));
          const idMatch = file.match(/^(TASK-\d+)/);
          if (idMatch) {
            this.appendLog(`[orchestrate] ${idMatch[1]}: in_progress → stopped`);
          }
        }
      }
    } catch (err) {
      this.appendLog(`[orchestrate] markAllInProgressAsStopped error: ${err}`);
    }
  }

  private cleanupZombies() {
    try {
      const projectRoot = path.resolve(process.cwd(), "..", "..");
      const tasksDir = path.join(projectRoot, ".orchestration", "tasks");
      if (!fs.existsSync(tasksDir)) return;

      const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith(".md"));
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(tasksDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        if (!content.includes("status: in_progress")) continue;

        const idMatch = file.match(/^(TASK-\d+)/);
        if (!idMatch) continue;
        const taskId = idMatch[1];
        const pidFile = `/tmp/worker-${taskId}.pid`;

        let alive = false;

        // PID 파일로 체크
        if (fs.existsSync(pidFile)) {
          try {
            const workerPid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
            if (!isNaN(workerPid)) {
              process.kill(workerPid, 0);
              alive = true;
            }
          } catch {
            try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
          }
        }

        // TaskRunnerManager가 관리 중인 태스크는 건너뛰기
        if (!alive) {
          try {
            const taskRunnerManager = (globalThis as Record<string, unknown>)["__taskRunnerManager__"] as { isRunning?: (id: string) => boolean } | undefined;
            if (taskRunnerManager?.isRunning?.(taskId)) {
              alive = true;
              this.appendLog(`[orchestrate] ${taskId}: TaskRunnerManager가 관리 중 → in_progress 유지`);
            }
          } catch { /* ignore */ }
        }

        // pgrep fallback
        if (!alive) {
          try {
            const result = execSync(`pgrep -f "job-task.sh ${taskId}|job-review.sh ${taskId}" 2>/dev/null || true`, { encoding: "utf-8" }).trim();
            if (result) {
              alive = true;
              this.appendLog(`[orchestrate] ${taskId}: PID 파일 없으나 프로세스 생존 → in_progress 유지`);
            }
          } catch { /* ignore */ }
        }

        if (!alive) {
          fs.writeFileSync(filePath, content.replace("status: in_progress", "status: stopped"));
          cleaned++;
          this.appendLog(`[orchestrate] zombie cleanup: ${taskId} in_progress → stopped`);
        }
      }

      if (cleaned > 0) this.appendLog(`[orchestrate] ${cleaned}개 좀비 태스크 정리 완료`);

      // stale lock 정리
      const lockDir = `${getTmpPrefix()}/lock`;
      if (fs.existsSync(lockDir)) {
        const pidFile = path.join(lockDir, "pid");
        if (fs.existsSync(pidFile)) {
          try {
            const lockPid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
            process.kill(lockPid, 0);
          } catch {
            fs.rmSync(lockDir, { recursive: true, force: true });
            this.appendLog("[orchestrate] stale lock 제거");
          }
        }
      }
    } catch (err) {
      console.error("[orchestrate] zombie cleanup error:", err);
    }
  }

  private appendLog(line: string) {
    this.state.logs.push(line);
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
      } catch { /* ignore */ }

      const tasksCompleted = this.state.taskResults.filter((r) => r.status === "success").length;
      const tasksFailed = this.state.taskResults.filter((r) => r.status === "failure").length;

      const entry: RunHistoryEntry = {
        id: `run-${this.state.startedAt.replace(/[^0-9]/g, "").slice(0, 14)}`,
        startedAt: this.state.startedAt,
        finishedAt: this.state.finishedAt,
        status: this.state.status as "completed" | "failed",
        exitCode: this.state.exitCode,
        taskResults: [...this.state.taskResults],
        totalCostUsd: parseFloat(totalCostUsd.toFixed(6)),
        totalDurationMs: durationMs,
        tasksCompleted,
        tasksFailed,
      };

      appendRunHistory(entry);
      this.appendLog(`[orchestrate] Run history saved: ${entry.id} (${tasksCompleted} completed, ${tasksFailed} failed, $${totalCostUsd.toFixed(4)})`);
    } catch (err) {
      const msg = getErrorMessage(err, String(err));
      this.appendLog(`[orchestrate] Failed to save run history: ${msg}`);
    }
  }

  private parseTaskResult(line: string) {
    const successMatch = line.match(/[✅✓]\s*(TASK-\d+)/);
    if (successMatch) {
      this.state.taskResults.push({ taskId: successMatch[1], status: "success" });
      return;
    }
    const failMatch = line.match(/[❌✗✘]\s*(TASK-\d+)/);
    if (failMatch) {
      this.state.taskResults.push({ taskId: failMatch[1], status: "failure" });
    }
  }
}

// Singleton — survives Next.js HMR by storing on globalThis
const globalKey = "__orchestrationManager__" as keyof typeof globalThis;
const orchestrationManager: OrchestrationManager =
  (globalThis as Record<string, unknown>)[globalKey] as OrchestrationManager ??
  (() => {
    const m = new OrchestrationManager();
    (globalThis as Record<string, unknown>)[globalKey] = m;
    return m;
  })();
export default orchestrationManager;
