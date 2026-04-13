/**
 * night-worker.ts — Night Worker 매니저
 * scripts/night-worker.sh의 Node.js 포팅
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PROJECT_ROOT, OUTPUT_DIR, TEMPLATE_DIR } from "../lib/paths";
import { writeNotice } from "../parser/notice-parser";
import { loadSettings } from "../lib/settings";
import { runClaudeJson } from "./claude-worker";
import {
  parseFrontmatter,
  getString,
  getStringArray,
} from "../lib/frontmatter-utils";
import { createTask, getNextTaskId } from "../service/task-store";

export interface NightWorkerOptions {
  until?: string; // HH:MM (기본 07:00)
  budget?: number | null;
  maxTasks?: number; // 기본 10
  types?: string; // 쉼표 구분 (typecheck,lint,review)
  instructions?: string;
}

export interface NightWorkerState {
  status: "idle" | "running" | "completed" | "stopped" | "failed";
  startedAt: string | null;
  until: string;
  budget: number | null;
  maxTasks: number;
  types: string;
  tasksCreated: number;
  totalCost: number;
  pid: number | null;
  logs: string[];
}

// 스캔 타입별 프롬프트
const TYPE_PROMPTS: Record<string, string> = {
  typecheck:
    "TypeScript 타입 오류를 찾아서 수정 태스크를 만들어주세요. strict 모드 기준으로 검사하세요.",
  lint: "ESLint 위반, 코드 스타일 문제를 찾아서 수정 태스크를 만들어주세요.",
  unused:
    "사용하지 않는 import, 변수, 함수, 파일을 찾아서 정리 태스크를 만들어주세요.",
  docs: "코드 분석 후 docs/todo/ 에 분석 보고서를 작성하는 태스크를 만들어주세요.",
  test: "테스트 커버리지가 부족한 부분을 찾아서 테스트 작성 태스크를 만들어주세요.",
  review:
    "코드 품질 문제(복잡도, 중복, 안티패턴)를 찾아서 검토 보고서 태스크를 만들어주세요.",
};

class NightWorkerManager {
  private _state: NightWorkerState = {
    status: "idle",
    startedAt: null,
    until: "07:00",
    budget: null,
    maxTasks: 10,
    types: "typecheck,lint,review",
    tasksCreated: 0,
    totalCost: 0,
    pid: null,
    logs: [],
  };

  private loopPromise: Promise<void> | null = null;
  private shouldStop = false;

  getState(): NightWorkerState {
    return { ...this._state, logs: [...this._state.logs] };
  }

  run(options: NightWorkerOptions): { success: boolean; error?: string } {
    if (this._state.status === "running") {
      return { success: false, error: "Night Worker가 이미 실행 중입니다" };
    }

    // 이전 루프 완전 종료 보장
    if (this.loopPromise) {
      this.shouldStop = true;
      const prevPromise = this.loopPromise;
      this.loopPromise = null;
      prevPromise.finally(() => {
        this.shouldStop = false;
        this.doRun(options);
      });
      // 즉시 성공 반환 — 이전 루프 종료 후 자동 시작됨
      this._state.status = "running";
      return { success: true };
    }

    return this.doRun(options);
  }

  private doRun(options: NightWorkerOptions): {
    success: boolean;
    error?: string;
  } {
    const settings = loadSettings();
    this.shouldStop = false;

    this._state = {
      status: "running",
      startedAt: new Date().toISOString(),
      until: options.until ?? settings.nightWorker.until,
      budget: options.budget ?? settings.nightWorker.budget,
      maxTasks: options.maxTasks ?? settings.nightWorker.maxTasks,
      types: options.types ?? settings.nightWorker.types,
      tasksCreated: 0,
      totalCost: 0,
      pid: process.pid,
      logs: [],
    };

    this.log(`🌙 Night Worker 시작`);
    this.log(`⏰ 종료 시간: ${this._state.until}`);
    this.log(`📊 최대 태스크: ${this._state.maxTasks}`);
    this.log(`🔍 스캔 타입: ${this._state.types}`);
    if (this._state.budget) this.log(`💰 예산: $${this._state.budget}`);

    this.saveState();

    // 비동기 루프 시작
    this.loopPromise = this.runLoop(options.instructions).catch((err) => {
      this.log(
        `❌ 루프 오류: ${err instanceof Error ? err.message : String(err)}`,
      );
      this._state.status = "failed";
      this.saveState();
    });

    return { success: true };
  }

  stop(): { success: boolean } {
    if (this._state.status !== "running") {
      return { success: false };
    }

    this.shouldStop = true;
    this._state.status = "stopped";
    this.log("🛑 Night Worker 종료 요청");
    this.saveState();
    return { success: true };
  }

  // ── 메인 루프 ───────────────────────────────────────

  private async runLoop(instructions?: string): Promise<void> {
    const types = this._state.types
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    let typeIndex = 0;

    while (!this.shouldStop) {
      // 종료 조건 체크
      if (this.shouldTerminate()) break;

      const currentType = types[typeIndex % types.length];
      typeIndex++;

      this.log(
        `\n🔍 스캔: ${currentType} (${this._state.tasksCreated}/${this._state.maxTasks})`,
      );

      try {
        const created = await this.scanAndCreateTask(currentType, instructions);
        if (created) {
          this._state.tasksCreated++;
          this.saveState();
        }
      } catch (err) {
        this.log(
          `⚠️ 스캔 오류: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // 타입 로테이션 완료 시 60초 대기, 아닌 경우 5초
      const sleepMs = typeIndex % types.length === 0 ? 60000 : 5000;
      await this.sleep(sleepMs);
    }

    if (this._state.status === "running") {
      this._state.status = "completed";
    }
    this.log(
      `\n🌙 Night Worker 종료 (태스크 ${this._state.tasksCreated}개 생성, 비용 $${this._state.totalCost.toFixed(4)})`,
    );
    this.saveState();
    this.postCompletionNotice();
  }

  private async scanAndCreateTask(
    type: string,
    instructions?: string,
  ): Promise<boolean> {
    const settings = loadSettings();
    const srcPaths = settings.srcPaths.join(", ");
    const typePrompt = TYPE_PROMPTS[type] ?? TYPE_PROMPTS.review;

    // 다음 태스크 ID 결정 (DB 기반)
    const nextId = getNextTaskId();

    // night-scan 프롬프트 빌드
    const nightScanTemplate = this.loadTemplate("prompt/night-scan.md");
    const date = new Date().toISOString().slice(0, 16).replace("T", " ");
    const prompt = nightScanTemplate
      .replace("{{src_paths}}", `스캔 대상: ${srcPaths}`)
      .replace("{{type_prompt}}", typePrompt)
      .replace(
        "{{instructions}}",
        instructions ? `\n추가 지시: ${instructions}` : "",
      )
      .replace(/\{\{task_id\}\}/g, nextId)
      .replace(/\{\{date\}\}/g, date);

    // Claude 호출
    const result = await runClaudeJson({
      prompt,
      model: "claude-haiku-4-5", // 스캔은 경량 모델
      cwd: PROJECT_ROOT,
      timeout: 900000, // 15분 (코드베이스 전체 스캔이므로 넉넉하게)
      onLine: (line) => this.log(line),
    });

    this._state.totalCost += result.costUsd;

    // NOT_FOUND 확인
    if (result.result.trim() === "NOT_FOUND" || !result.result.trim()) {
      this.log(`  ℹ️ ${type}: 이슈 없음`);
      return false;
    }

    // Claude 결과에서 태스크 정보 추출
    const taskContent = result.result.trim();

    // frontmatter에서 title 추출 시도
    let title = "";
    let role = "general";
    let priority = "medium";
    let scope: string[] = [];
    let dependsOn: string[] = [];
    let bodyContent = taskContent;

    const { data } = parseFrontmatter(taskContent);
    title = getString(data, "title");
    if (data.role) role = getString(data, "role") || "general";
    if (data.priority) priority = getString(data, "priority") || "medium";
    if (data.scope) scope = getStringArray(data, "scope");
    if (data.depends_on) dependsOn = getStringArray(data, "depends_on");

    // frontmatter가 있으면 body만 추출
    if (taskContent.startsWith("---")) {
      const endIdx = taskContent.indexOf("---", 3);
      if (endIdx !== -1) {
        bodyContent = taskContent.slice(endIdx + 3).trim();
      }
    }

    if (!title) {
      // markdown heading에서 추출
      const headingMatch = taskContent.match(/^#+\s+(.+)/m);
      title = headingMatch
        ? headingMatch[1].trim()
        : `${type}-auto-${Date.now()}`;
    }

    // DB에 태스크 생성
    createTask({
      id: nextId,
      title,
      status: "pending",
      priority,
      role,
      scope,
      depends_on: dependsOn,
      content: bodyContent,
    });

    this.log(`  ✅ 태스크 생성: ${nextId} — ${title}`);

    return true;
  }

  // ── 종료 조건 ───────────────────────────────────────

  private shouldTerminate(): boolean {
    if (this.shouldStop) return true;

    // 태스크 수 제한
    if (this._state.tasksCreated >= this._state.maxTasks) {
      this.log(`📊 최대 태스크 수 도달 (${this._state.maxTasks})`);
      return true;
    }

    // 예산 제한
    if (
      this._state.budget !== null &&
      this._state.totalCost >= this._state.budget
    ) {
      this.log(
        `💰 예산 초과 ($${this._state.totalCost.toFixed(2)} >= $${this._state.budget})`,
      );
      return true;
    }

    // 시간 제한 — 시작 시간 기반으로 경과 시간 계산
    const [h, m] = this._state.until.split(":").map(Number);
    if (this._state.startedAt) {
      const startTime = new Date(this._state.startedAt).getTime();
      const elapsed = Date.now() - startTime;

      // until 시간까지 남은 시간 계산 (로컬 시간 기준)
      const now = new Date();
      // 로컬 시간으로 비교 (getHours는 로컬 시간 반환하지만 서버가 UTC일 수 있음)
      // 대신 경과 시간 기반으로: 시작 후 최대 실행 시간을 계산
      const startDate = new Date(this._state.startedAt);
      const endDate = new Date(startDate);
      endDate.setHours(h, m, 0, 0);

      // 종료 시간이 시작 시간보다 이전이면 다음 날로
      if (endDate.getTime() <= startDate.getTime()) {
        endDate.setDate(endDate.getDate() + 1);
      }

      if (Date.now() >= endDate.getTime()) {
        this.log(`⏰ 종료 시간 도달 (${this._state.until})`);
        return true;
      }
    }

    return false;
  }

  // ── 유틸리티 ────────────────────────────────────────

  private loadTemplate(tplPath: string): string {
    const paths = [
      path.join(TEMPLATE_DIR, tplPath),
      path.resolve(process.cwd(), "template", tplPath),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
    }
    throw new Error(`Template not found: ${tplPath}`);
  }

  private log(msg: string): void {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    this._state.logs.push(line);

    // 로그 파일에도 기록
    try {
      const logFile = path.join(OUTPUT_DIR, "logs", "night-worker.log");
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.appendFileSync(logFile, line + "\n");
    } catch {
      /* ignore */
    }
  }

  private saveState(): void {
    try {
      const projHash = crypto
        .createHash("md5")
        .update(PROJECT_ROOT)
        .digest("hex")
        .slice(0, 8);
      const stateDir = path.join("/tmp", `orchestrate-${projHash}`);
      fs.mkdirSync(stateDir, { recursive: true });
      const stateFile = path.join(stateDir, "night-worker.state");
      fs.writeFileSync(
        stateFile,
        JSON.stringify(
          {
            status: this._state.status,
            startedAt: this._state.startedAt,
            until: this._state.until,
            budget: this._state.budget,
            maxTasks: this._state.maxTasks,
            types: this._state.types,
            tasksCreated: this._state.tasksCreated,
            totalCost: this._state.totalCost,
            pid: process.pid,
          },
          null,
          2,
        ),
      );
    } catch {
      /* ignore */
    }
  }

  private async sleep(ms: number): Promise<void> {
    // 100ms 단위로 체크하여 빠른 중지 지원
    const chunks = Math.ceil(ms / 100);
    for (let i = 0; i < chunks; i++) {
      if (this.shouldStop) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private postCompletionNotice(): void {
    writeNotice(
      "info",
      "Night Worker 야간 작업 완료",
      `태스크 ${this._state.tasksCreated}개 생성, 총 비용 $${this._state.totalCost.toFixed(4)}`,
    );
  }
}

// 싱글톤
const globalKey = "__nightWorkerManager__";
const nightWorkerManager: NightWorkerManager =
  ((globalThis as Record<string, unknown>)[globalKey] as NightWorkerManager) ??
  ((globalThis as Record<string, unknown>)[globalKey] =
    new NightWorkerManager());

export default nightWorkerManager;
