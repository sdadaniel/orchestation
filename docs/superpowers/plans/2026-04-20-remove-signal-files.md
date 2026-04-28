# 시그널 파일 제거 + 상태 전이 단일화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오케스트레이션 엔진에서 `.orchestration/signals/` 시그널 파일 우회 경로를 제거하고, 모든 태스크 상태 전이를 `task-transitions.ts` 단일 도메인 모듈에서 처리하도록 바꾼다.

**Architecture:** 현재 `job-task`/`job-review`가 `signalCreate()`로 파일을 남기고 `mainLoop`가 3초마다 폴링해서 `handleSignal()`로 DB 갱신하는 구조를, `runJobTask().then(result)` 시점에 `onTaskFinished()`를 직접 호출하는 구조로 바꾼다. 상태 전이 로직(머지·리뷰 retry·비용 한도·실패 처리)은 `task-transitions.ts`로 모으고, 엔진의 `healthCheck`/`cleanupZombies`도 같은 모듈의 `markTaskFailed`를 사용하도록 통일한다.

**Tech Stack:** Node.js 20+, TypeScript, better-sqlite3 (task-store), vitest (unit tests)

**Scope (이번 플랜):**
- OrchestrateEngine 경로 시그널 제거
- `task-transitions.ts` 신설 및 `signal-handler.ts` 폐기

**Out of Scope (후속 플랜):**
- iTerm runner (`task-runner-iterm.ts`) 시그널 사용 — 별도 경로라 유지
- `ops/signal.ts` 파일 자체 — iTerm 쪽이 쓰므로 이번에 삭제 안 함 (참조 전부 끊기면 후속 플랜에서 정리)
- 크래시 내구성 개선, `retry-counts.json` → SQLite, 타임아웃 설정화, 로그 async 전환

---

## File Structure

**Create:**
- `src/frontend/src/engine/core/task-transitions.ts` — 상태 전이 단일 진입점 (`onTaskFinished`, `onReviewFinished`) + 보조 함수 (`markTaskFailed`, `markTaskRejected`, `finalizeTask`) + pure decision helpers
- `src/frontend/src/engine/core/task-transitions.test.ts` — retry/cost 판정 순수 함수 단위 테스트

**Modify:**
- `src/frontend/src/engine/core/orchestrate-engine.ts` — `processSignals` 제거, `fs.watch`/`SIGNALS_DIR` 제거, `startTask`/`startReview`의 `.then(result)`에서 transitions 호출, `healthCheck`/`cleanupZombies`의 `markTaskFailed` import 경로 변경
- `src/frontend/src/engine/jobs/job-task.ts` — `signalCreate` 호출 전부 제거, `JobTaskResult`만 반환
- `src/frontend/src/engine/jobs/job-review.ts` — `signalCreate` 호출 전부 제거, `JobReviewResult`만 반환

**Delete:**
- `src/frontend/src/engine/core/signal-handler.ts` — 로직이 `task-transitions.ts`로 모두 이전된 후 삭제
- `src/frontend/src/engine/signal-handler.ts` — re-export 스텁이므로 같이 삭제

**Preserve (iTerm runner 호환):**
- `src/frontend/src/engine/ops/signal.ts`
- `src/frontend/src/engine/signal.ts`
- `src/frontend/src/engine/runner/task-runner-utils.ts` (`cleanupSignals` 유지)

---

## Task 0: Setup — 작업 브랜치 확인

**Files:** (없음 — git 준비만)

- [ ] **Step 0.1: 현재 상태 확인**

Run: `git -C /Users/leo/Desktop/sdadaniel/orchestation status --short`
Expected: 여러 M/?? 파일. 이번 플랜은 main 위에서 작업하되, 기존 uncommitted 변경은 건드리지 않는다.

- [ ] **Step 0.2: 관련 파일 전부 한 번 읽기**

Read these in order:
- `src/frontend/src/engine/core/orchestrate-engine.ts`
- `src/frontend/src/engine/core/signal-handler.ts`
- `src/frontend/src/engine/ops/signal.ts`
- `src/frontend/src/engine/jobs/job-task.ts`
- `src/frontend/src/engine/jobs/job-review.ts`
- `src/frontend/src/service/task-store.ts` (updateTaskStatus 시그니처 확인용)

---

## Task 1: `task-transitions.ts` 스켈레톤 + 타입 정의

**Files:**
- Create: `src/frontend/src/engine/core/task-transitions.ts`

- [ ] **Step 1.1: 파일 생성**

```typescript
/**
 * task-transitions.ts
 *
 * 태스크 상태 전이를 단일 책임으로 모은 도메인 모듈.
 * 시그널 파일 경로를 대체한다 — 잡 완료 시점(runJobTask/runJobReview의 .then)에서
 * 엔진이 직접 호출한다.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT, OUTPUT_DIR } from "../../lib/paths";
import { writeNotice } from "../../parser/notice-parser";
import { parseCostLog } from "../../parser/cost-parser";
import { getTask, updateTaskStatus } from "../../service/task-store";
import { runMergeTask } from "../ops/merge-utils";
import { SKIP_REVIEW_ROLES } from "../runner/task-runner-utils";
import { scanTasks, taskRowToInfo, type TaskInfo } from "./scheduler";
import type { JobTaskResult } from "../jobs/job-task";
import type { JobReviewResult } from "../jobs/job-review";

export const MAX_TASK_COST = 5.0;

/** 엔진이 transitions에 넘기는 콜백/설정 묶음. */
export interface TransitionContext {
  log: (msg: string) => void;
  startTask: (taskId: string, feedbackFile?: string) => boolean;
  startReview: (taskId: string) => boolean;
  emitTaskResult: (taskId: string, status: "success" | "failure") => void;
  getRetryCount: (taskId: string) => number;
  bumpRetryCount: (taskId: string) => number;
  clearRetryCount: (taskId: string) => void;
  maxReviewRetry: () => number;
  baseBranch: () => string;
}

// 진입점 (Task 3, 4에서 구현)
export async function onTaskFinished(
  taskId: string,
  result: JobTaskResult,
  ctx: TransitionContext,
): Promise<void> {
  throw new Error("not implemented");
}

export async function onReviewFinished(
  taskId: string,
  result: JobReviewResult,
  ctx: TransitionContext,
): Promise<void> {
  throw new Error("not implemented");
}
```

- [ ] **Step 1.2: tsc로 타입 컴파일 확인**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx tsc --noEmit 2>&1 | grep task-transitions`
Expected: 출력 없음 (새 파일 타입 오류 없음). `JobTaskResult`/`JobReviewResult` 순환 참조 없음 확인.

- [ ] **Step 1.3: Commit**

```bash
git -C /Users/leo/Desktop/sdadaniel/orchestation add src/frontend/src/engine/core/task-transitions.ts
git -C /Users/leo/Desktop/sdadaniel/orchestation commit -m "feat(engine): task-transitions.ts 스켈레톤 추가"
```

---

## Task 2: 보조 함수 이전 (signal-handler.ts → task-transitions.ts)

**Files:**
- Modify: `src/frontend/src/engine/core/task-transitions.ts`

`signal-handler.ts`의 순수 로직을 그대로 옮긴다. 원본은 Task 9에서 삭제하므로 일단 중복 상태로 둔다 (빌드 안전).

- [ ] **Step 2.1: 내부 헬퍼 추가**

`task-transitions.ts`의 `onReviewFinished` 아래에 다음 함수들을 추가한다:

```typescript
// ── 상태 전이 primitive ─────────────────────────────────

export async function finalizeTask(
  taskId: string,
  ctx: TransitionContext,
): Promise<void> {
  const info = readTaskInfo(taskId);
  if (!info) return;

  const success = await runMergeTask(taskId, (line) => ctx.log(`  ${line}`));

  if (success) {
    ctx.clearRetryCount(taskId);
    writeNotice(
      "info",
      `${taskId} 완료`,
      `**${taskId}:** ${info.title}\n\n태스크가 성공적으로 완료되어 ${ctx.baseBranch()}에 머지되었습니다.`,
    );
    ctx.emitTaskResult(taskId, "success");
    ctx.log(`  ✅ ${taskId} 완료 → ${ctx.baseBranch()} 머지됨`);
  } else {
    markTaskFailed(taskId, "merge 실패", ctx);
  }
}

export function markTaskFailed(
  taskId: string,
  reason: string,
  ctx: TransitionContext,
): void {
  setTaskStatus(taskId, "failed", ctx.log);
  cleanupWorktreeAndBranch(taskId);
  ctx.clearRetryCount(taskId);
  writeNotice("error", `${taskId} 실패`, `**${taskId}:** ${reason}`);
  stopDependents(taskId, ctx.log);
  ctx.emitTaskResult(taskId, "failure");
}

export function markTaskRejected(
  taskId: string,
  reason: string,
  ctx: TransitionContext,
): void {
  setTaskStatus(taskId, "rejected", ctx.log);
  cleanupWorktreeAndBranch(taskId);
  ctx.clearRetryCount(taskId);
  writeNotice("warning", `${taskId} 거절`, `**${taskId}:** ${reason}`);
}

// ── pure helpers (테스트 대상) ─────────────────────────

/** 지금까지 누적 비용이 MAX_TASK_COST 초과면 true. 파일 I/O 있으나 순수에 가깝게 설계. */
export function isCostOverLimit(taskId: string, log: (msg: string) => void): boolean {
  try {
    const costData = parseCostLog();
    let total = 0;
    for (const entry of costData.entries) {
      if (entry.taskId === taskId) total += entry.costUsd;
    }
    if (total > MAX_TASK_COST) {
      log(
        `  🚨 ${taskId} 비용 상한 초과 ($${total.toFixed(2)} > $${MAX_TASK_COST})`,
      );
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** 현재 retry count가 max 미만이면 true. 테스트 용이한 순수 함수. */
export function canRetryReview(current: number, max: number): boolean {
  return current < max;
}

// ── 내부 헬퍼 ───────────────────────────────────────────

function setTaskStatus(
  taskId: string,
  newStatus: string,
  log: (msg: string) => void,
): void {
  const row = getTask(taskId);
  if (!row) {
    log(`  ⚠️  ${taskId}: DB에 없음`);
    return;
  }
  updateTaskStatus(
    taskId,
    newStatus as Parameters<typeof updateTaskStatus>[1],
    row.status,
  );
}

function readTaskInfo(taskId: string): TaskInfo | null {
  const row = getTask(taskId);
  if (!row) return null;
  return taskRowToInfo(row);
}

function cleanupWorktreeAndBranch(taskId: string): void {
  const info = readTaskInfo(taskId);
  if (!info) return;
  const worktreePath = info.worktree
    ? path.resolve(PROJECT_ROOT, info.worktree)
    : null;
  if (worktreePath && fs.existsSync(worktreePath)) {
    try {
      execSync(
        `git -C "${PROJECT_ROOT}" worktree remove "${worktreePath}" --force`,
        { stdio: "ignore" },
      );
    } catch {
      /* ignore */
    }
  }
  if (info.branch) {
    try {
      execSync(`git -C "${PROJECT_ROOT}" branch -D "${info.branch}"`, {
        stdio: "ignore",
      });
    } catch {
      /* ignore */
    }
  }
}

function stopDependents(failedId: string, log: (msg: string) => void): void {
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

- [ ] **Step 2.2: 빌드 확인**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: `task-transitions.ts` 관련 오류 없음. (signal-handler.ts 쪽은 아직 그대로 존재하므로 기존 동작 유지.)

- [ ] **Step 2.3: Commit**

```bash
git -C /Users/leo/Desktop/sdadaniel/orchestation add src/frontend/src/engine/core/task-transitions.ts
git -C /Users/leo/Desktop/sdadaniel/orchestation commit -m "feat(engine): 상태 전이 primitive 이전 (markTaskFailed/Rejected/finalizeTask)"
```

---

## Task 3: `onTaskFinished` 구현

**Files:**
- Modify: `src/frontend/src/engine/core/task-transitions.ts`

`runJobTask` 완료 시 엔진이 호출할 단일 진입점. 현재 `handleSignal`의 `task-done` / `task-failed` / `task-rejected` 분기를 `JobTaskResult.status`로 분기하도록 포팅.

- [ ] **Step 3.1: 스켈레톤을 실제 구현으로 교체**

`task-transitions.ts`의 `onTaskFinished` 함수를 다음으로 대체한다:

```typescript
export async function onTaskFinished(
  taskId: string,
  result: JobTaskResult,
  ctx: TransitionContext,
): Promise<void> {
  switch (result.status) {
    case "task-done": {
      const info = readTaskInfo(taskId);
      const role = info?.role ?? "";
      if (SKIP_REVIEW_ROLES.includes(role)) {
        ctx.log(`  ✅ ${taskId} task 완료 → review 스킵 → 머지`);
        await finalizeTask(taskId, ctx);
      } else {
        ctx.log(`  ✅ ${taskId} task 완료 → review 시작`);
        ctx.startReview(taskId);
      }
      return;
    }

    case "task-rejected": {
      ctx.log(`  🚫 ${taskId} 거절됨`);
      let reason = "";
      const reasonFile = path.join(
        OUTPUT_DIR,
        `${taskId}-rejection-reason.txt`,
      );
      if (fs.existsSync(reasonFile))
        reason = fs.readFileSync(reasonFile, "utf-8").split("\n")[0];
      markTaskRejected(taskId, reason, ctx);
      return;
    }

    case "task-failed":
      ctx.log(`  ❌ ${taskId} task 실행 실패`);
      markTaskFailed(taskId, "task 실행 실패", ctx);
      return;
  }
}
```

- [ ] **Step 3.2: 빌드 확인**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx tsc --noEmit 2>&1 | grep task-transitions`
Expected: 출력 없음.

- [ ] **Step 3.3: Commit**

```bash
git -C /Users/leo/Desktop/sdadaniel/orchestation add src/frontend/src/engine/core/task-transitions.ts
git -C /Users/leo/Desktop/sdadaniel/orchestation commit -m "feat(engine): onTaskFinished 진입점 구현"
```

---

## Task 4: `onReviewFinished` 구현 (retry / cost limit 포함)

**Files:**
- Modify: `src/frontend/src/engine/core/task-transitions.ts`

`handleSignal`의 `review-approved` / `review-rejected` 분기 포팅. retry 제한 초과 시 failed 처리, 비용 상한 초과 시도 failed.

- [ ] **Step 4.1: 스켈레톤 교체**

`task-transitions.ts`의 `onReviewFinished`를 다음으로 대체한다:

```typescript
export async function onReviewFinished(
  taskId: string,
  result: JobReviewResult,
  ctx: TransitionContext,
): Promise<void> {
  if (result.status === "review-approved") {
    ctx.log(`  ✅ ${taskId} review 승인 → 머지`);
    await finalizeTask(taskId, ctx);
    return;
  }

  // review-rejected
  if (isCostOverLimit(taskId, ctx.log)) {
    markTaskFailed(taskId, "비용 상한 초과", ctx);
    return;
  }

  const count = ctx.getRetryCount(taskId);
  if (canRetryReview(count, ctx.maxReviewRetry())) {
    const next = ctx.bumpRetryCount(taskId);
    ctx.log(
      `  🔄 ${taskId} review 수정요청 → retry (${next}/${ctx.maxReviewRetry()})`,
    );
    const feedbackFile = path.join(
      OUTPUT_DIR,
      `${taskId}-review-feedback.txt`,
    );
    ctx.startTask(taskId, feedbackFile);
  } else {
    ctx.log(`  ❌ ${taskId} retry 상한 초과 (${ctx.maxReviewRetry()})`);
    markTaskFailed(taskId, "review retry 상한 초과", ctx);
  }
}
```

- [ ] **Step 4.2: 빌드 확인**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx tsc --noEmit 2>&1 | grep task-transitions`
Expected: 출력 없음.

- [ ] **Step 4.3: Commit**

```bash
git -C /Users/leo/Desktop/sdadaniel/orchestation add src/frontend/src/engine/core/task-transitions.ts
git -C /Users/leo/Desktop/sdadaniel/orchestation commit -m "feat(engine): onReviewFinished 진입점 구현 (retry/cost limit)"
```

---

## Task 5: 순수 판정 함수 단위 테스트

**Files:**
- Create: `src/frontend/src/engine/core/task-transitions.test.ts`

- [ ] **Step 5.1: 실패 테스트 작성**

```typescript
import { describe, it, expect } from "vitest";
import { canRetryReview } from "./task-transitions";

describe("canRetryReview", () => {
  it("현재 카운트가 max 미만이면 retry 가능", () => {
    expect(canRetryReview(0, 3)).toBe(true);
    expect(canRetryReview(2, 3)).toBe(true);
  });

  it("현재 카운트가 max 이상이면 retry 불가", () => {
    expect(canRetryReview(3, 3)).toBe(false);
    expect(canRetryReview(4, 3)).toBe(false);
  });

  it("max가 0이면 즉시 불가", () => {
    expect(canRetryReview(0, 0)).toBe(false);
  });
});
```

- [ ] **Step 5.2: 테스트 실행 (PASS 확인)**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx vitest run --project unit task-transitions 2>&1 | tail -15`
Expected: `Tests  3 passed (3)`

- [ ] **Step 5.3: Commit**

```bash
git -C /Users/leo/Desktop/sdadaniel/orchestation add src/frontend/src/engine/core/task-transitions.test.ts
git -C /Users/leo/Desktop/sdadaniel/orchestation commit -m "test(engine): canRetryReview 단위 테스트"
```

> **Note:** `isCostOverLimit`는 `parseCostLog`(파일 I/O)에 의존해 단위 테스트가 불필요하게 무거워진다. 이번 플랜에선 `canRetryReview`만 테스트한다.

---

## Task 6: Engine 배선 — `job-task` 컷오버 (시그널 제거 + 직접 호출 원자적 교체)

**Files:**
- Modify: `src/frontend/src/engine/core/orchestrate-engine.ts`
- Modify: `src/frontend/src/engine/jobs/job-task.ts`

`runJobTask` 완료 시 시그널 파일 대신 `onTaskFinished`를 직접 호출한다. 두 변경은 **한 커밋**으로 원자적으로 수행 (중간 상태에서 잡이 끝나도 누락 없게).

- [ ] **Step 6.1: `orchestrate-engine.ts`의 `startTask` 수정**

기존 `orchestrate-engine.ts:317-342` 부분 (`runJobTask().then(result => { this.log(...) })`)를 다음으로 바꾼다:

```typescript
const abortController = new AbortController();
const promise = runJobTask(taskId, feedbackFile, (line) => {
  this.log(`  ${line}`);
  try {
    fs.appendFileSync(logFile, line + "\n");
  } catch {
    /* ignore */
  }
})
  .then(async (result) => {
    this.log(`  [${taskId}/task] 완료: ${result.status}`);
    this.workers.delete(taskId);
    await onTaskFinished(taskId, result, this.buildTransitionContext());
  })
  .catch(async (err) => {
    this.log(
      `  ❌ ${taskId}: task 오류: ${err instanceof Error ? err.message : String(err)}`,
    );
    this.workers.delete(taskId);
    await onTaskFinished(
      taskId,
      { status: "task-failed" },
      this.buildTransitionContext(),
    );
  });
```

- [ ] **Step 6.2: `buildTransitionContext` 메서드 추가**

`orchestrate-engine.ts`의 `buildSignalCallbacks` 아래에 다음 추가 (기존 콜백 재사용):

```typescript
/** task-transitions 용 컨텍스트. buildSignalCallbacks의 부분집합 + removeWorker 뺌. */
private buildTransitionContext(): TransitionContext {
  return {
    log: (msg) => this.log(msg),
    startTask: (taskId, feedbackFile) => this.startTask(taskId, feedbackFile),
    startReview: (taskId) => this.startReview(taskId),
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
```

Import 추가 (`orchestrate-engine.ts` 상단):

```typescript
import {
  onTaskFinished,
  onReviewFinished,
  type TransitionContext,
} from "./task-transitions";
```

- [ ] **Step 6.3: `job-task.ts`에서 `signalCreate` 전부 제거**

파일 전체에서 `signalCreate(...)` 호출 4곳(`:45`, `:160`, `:174`, `:187`, `:204`) + `let signalSent = false` + 관련 분기를 정리. `signalCreate` import도 제거.

구체적으로 `job-task.ts`를 다음 패턴으로 수정:
- Line 10: `import { signalCreate } from "../ops/signal";` 삭제
- Line 38: `let signalSent = false;` 삭제
- Line 45-48 (getTask 실패):
  ```typescript
  if (!task) {
    log("❌ 태스크를 찾을 수 없음");
    return { status: "task-failed" };
  }
  ```
- Line 160-161: `signalCreate(taskId, "task-rejected"); signalSent = true;` 삭제
- Line 174-175: `signalCreate(taskId, "task-failed"); signalSent = true;` 삭제
- Line 187-189: `signalCreate(taskId, "task-done"); signalSent = true; log(...)` → `log('✅ task-done 반환')`로 교체
- Line 202-208 (catch 블록의 signalSent 분기): 통째로 `/* ignore */` 남기고 제거. 최종 `return { status: "task-failed" }`만 남김.

- [ ] **Step 6.4: 빌드 확인**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx tsc --noEmit 2>&1 | grep -E "orchestrate-engine|job-task"`
Expected: 출력 없음.

- [ ] **Step 6.5: Commit**

```bash
git -C /Users/leo/Desktop/sdadaniel/orchestation add src/frontend/src/engine/core/orchestrate-engine.ts src/frontend/src/engine/jobs/job-task.ts
git -C /Users/leo/Desktop/sdadaniel/orchestation commit -m "refactor(engine): job-task 완료 시 시그널 대신 onTaskFinished 직접 호출"
```

---

## Task 7: Engine 배선 — `job-review` 컷오버

**Files:**
- Modify: `src/frontend/src/engine/core/orchestrate-engine.ts`
- Modify: `src/frontend/src/engine/jobs/job-review.ts`

Task 6과 동일 패턴을 리뷰 경로에 적용.

- [ ] **Step 7.1: `orchestrate-engine.ts`의 `startReview` 수정**

기존 `orchestrate-engine.ts:345-376` 부분 (`runJobReview().then(result => { this.log(...) })`)를:

```typescript
const abortController = new AbortController();
const promise = runJobReview(taskId, (line) => {
  this.log(`  ${line}`);
  try {
    fs.appendFileSync(logFile, line + "\n");
  } catch {
    /* ignore */
  }
})
  .then(async (result) => {
    this.log(`  [${taskId}/review] 완료: ${result.status}`);
    this.workers.delete(taskId);
    await onReviewFinished(taskId, result, this.buildTransitionContext());
  })
  .catch(async (err) => {
    this.log(
      `  ❌ ${taskId}: review 오류: ${err instanceof Error ? err.message : String(err)}`,
    );
    this.workers.delete(taskId);
    await onReviewFinished(
      taskId,
      { status: "review-rejected" },
      this.buildTransitionContext(),
    );
  });
```

- [ ] **Step 7.2: `job-review.ts`에서 `signalCreate` 제거**

- Line 9: `import { signalCreate } from "../ops/signal";` 삭제
- Line 32: `let signalSent = false;` 삭제
- Line 39, 58, 133, 144, 158: `signalCreate(...)` 호출 + `signalSent = true` 전부 삭제
- Line 156-162 (catch 블록): `if (!signalSent) { signalCreate(...) }` 블록 삭제, `return { status: "review-rejected" }`만 유지

- [ ] **Step 7.3: 빌드 확인**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx tsc --noEmit 2>&1 | grep -E "orchestrate-engine|job-review"`
Expected: 출력 없음.

- [ ] **Step 7.4: Commit**

```bash
git -C /Users/leo/Desktop/sdadaniel/orchestation add src/frontend/src/engine/core/orchestrate-engine.ts src/frontend/src/engine/jobs/job-review.ts
git -C /Users/leo/Desktop/sdadaniel/orchestation commit -m "refactor(engine): job-review 완료 시 시그널 대신 onReviewFinished 직접 호출"
```

---

## Task 8: `processSignals` 호출 제거 + 시그널 인프라 정리

**Files:**
- Modify: `src/frontend/src/engine/core/orchestrate-engine.ts`

이 시점에 시그널 파일은 더 이상 생성되지 않으므로 폴링/와처는 dead code. 제거.

- [ ] **Step 8.1: `mainLoop`에서 `processSignals` 호출 제거**

`orchestrate-engine.ts:403`의 `processSignals(this.buildSignalCallbacks());` 라인 삭제.

- [ ] **Step 8.2: `start()`에서 `SIGNALS_DIR` mkdir + `startSignalWatcher` 제거**

`orchestrate-engine.ts:112`의 `fs.mkdirSync(SIGNALS_DIR, { recursive: true });` 삭제.
`orchestrate-engine.ts:120`의 `this.startSignalWatcher();` 삭제.

- [ ] **Step 8.3: `stop()`에서 watcher + SIGNALS_DIR 삭제 제거**

`orchestrate-engine.ts:138-146` 부분:

```typescript
if (this.signalWatcher) {
  this.signalWatcher.close();
  this.signalWatcher = null;
}
try {
  fs.rmSync(SIGNALS_DIR, { recursive: true, force: true });
} catch {
  /* ignore */
}
```

전부 삭제.

- [ ] **Step 8.4: `signalWatcher` 필드 + `startSignalWatcher` 메서드 제거**

`orchestrate-engine.ts:84`의 `private signalWatcher: fs.FSWatcher | null = null;` 삭제.
`orchestrate-engine.ts:378-390`의 `startSignalWatcher` 메서드 전체 삭제.

- [ ] **Step 8.5: `SIGNALS_DIR` import 제거**

`orchestrate-engine.ts:12-17`의 import에서 `SIGNALS_DIR` 토큰 삭제.

- [ ] **Step 8.6: 빌드 확인**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx tsc --noEmit 2>&1 | grep orchestrate-engine`
Expected: 출력 없음.

- [ ] **Step 8.7: Commit**

```bash
git -C /Users/leo/Desktop/sdadaniel/orchestation add src/frontend/src/engine/core/orchestrate-engine.ts
git -C /Users/leo/Desktop/sdadaniel/orchestation commit -m "refactor(engine): processSignals/fs.watch/SIGNALS_DIR 사용 제거"
```

---

## Task 9: `healthCheck` / `cleanupZombies` 경로 단일화

**Files:**
- Modify: `src/frontend/src/engine/core/orchestrate-engine.ts`

기존 두 곳은 `signal-handler.markTaskFailed`를 직접 호출했음 (시그널 우회). 이제 `task-transitions.markTaskFailed`로 통일.

- [ ] **Step 9.1: import 경로 변경**

`orchestrate-engine.ts` 상단 import에서:

```typescript
import {
  processSignals,
  markTaskFailed,
  type SignalHandlerCallbacks,
} from "./signal-handler";
```

를 제거하고 Task 6에서 추가한 task-transitions import에 `markTaskFailed` 추가:

```typescript
import {
  onTaskFinished,
  onReviewFinished,
  markTaskFailed,
  type TransitionContext,
} from "./task-transitions";
```

- [ ] **Step 9.2: `healthCheck`의 호출 교체**

`orchestrate-engine.ts:440-444` 부분:

```typescript
markTaskFailed(
  taskId,
  "워커 타임아웃 (30분)",
  this.buildSignalCallbacks(),
);
```

를:

```typescript
markTaskFailed(
  taskId,
  "워커 타임아웃 (30분)",
  this.buildTransitionContext(),
);
```

- [ ] **Step 9.3: `cleanupZombies`의 호출 교체**

`orchestrate-engine.ts:449-466`에서 `const cb = this.buildSignalCallbacks();` → `const ctx = this.buildTransitionContext();`로 바꾸고, `markTaskFailed(row.id, "...", cb)` → `markTaskFailed(row.id, "...", ctx)`.

- [ ] **Step 9.4: `buildSignalCallbacks` 메서드 삭제**

`orchestrate-engine.ts:173-195`의 `buildSignalCallbacks` 메서드 전체 삭제 (더 이상 호출자 없음).

- [ ] **Step 9.5: 빌드 확인**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: `signal-handler` 관련 오류만 남아야 함 (다음 Task에서 삭제 예정). 그 외 오류 없음.

- [ ] **Step 9.6: Commit**

```bash
git -C /Users/leo/Desktop/sdadaniel/orchestation add src/frontend/src/engine/core/orchestrate-engine.ts
git -C /Users/leo/Desktop/sdadaniel/orchestation commit -m "refactor(engine): healthCheck/cleanupZombies도 task-transitions.markTaskFailed 사용"
```

---

## Task 10: `signal-handler.ts` 삭제

**Files:**
- Delete: `src/frontend/src/engine/core/signal-handler.ts`
- Delete: `src/frontend/src/engine/signal-handler.ts`

이제 참조하는 코드가 없음. 제거.

- [ ] **Step 10.1: 마지막 참조 확인**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation && grep -rn "signal-handler" src/frontend/src 2>&1`
Expected: 출력 없음 (또는 주석/문서만).

- [ ] **Step 10.2: 파일 삭제**

```bash
rm /Users/leo/Desktop/sdadaniel/orchestation/src/frontend/src/engine/core/signal-handler.ts
rm /Users/leo/Desktop/sdadaniel/orchestation/src/frontend/src/engine/signal-handler.ts
```

- [ ] **Step 10.3: 전체 빌드 확인**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: 오류 없음.

- [ ] **Step 10.4: Commit**

```bash
git -C /Users/leo/Desktop/sdadaniel/orchestation add -A src/frontend/src/engine/
git -C /Users/leo/Desktop/sdadaniel/orchestation commit -m "chore(engine): signal-handler.ts 삭제 (task-transitions로 대체 완료)"
```

---

## Task 11: 최종 검증

**Files:** (변경 없음 — 검증만)

- [ ] **Step 11.1: 전체 타입체크**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx tsc --noEmit 2>&1 | tail -5`
Expected: `error` 단어 없음 (0 errors).

- [ ] **Step 11.2: 단위 테스트 전체 실행**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npx vitest run --project unit 2>&1 | tail -10`
Expected: 모든 테스트 PASS. `canRetryReview` 테스트 포함.

- [ ] **Step 11.3: 린트**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npm run lint 2>&1 | tail -10`
Expected: 경고 있더라도 신규 에러 없음.

- [ ] **Step 11.4: 포맷 체크**

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && npm run format:check 2>&1 | tail -5`
Expected: 통과. 실패 시 `npm run format` 실행 후 재확인.

- [ ] **Step 11.5: 시그널 디렉터리 잔해 확인**

Run: `ls -la /Users/leo/Desktop/sdadaniel/orchestation/.orchestration/signals 2>&1 || echo "없음"`
Expected: 없거나 비어 있음. 파일이 있으면 수동 삭제.

- [ ] **Step 11.6: 수동 스모크 테스트**

포트 3001로 dev 서버 기동 후 (feedback memory: 테스트 시 3001번 포트):

Run: `cd /Users/leo/Desktop/sdadaniel/orchestation/src/frontend && PORT=3001 npm run dev`

브라우저에서:
1. 기존 pending 태스크 한 개 실행
2. 완료 로그 확인: `✅ TASK-XXX task 완료 → review 시작`이 **3초 지연 없이** 즉시 찍히는지 확인
3. `.orchestration/signals/` 디렉터리가 생성되지 **않는지** 확인
4. 리뷰 승인 → 머지 → done 까지 정상 동작
5. 실패 시나리오 (role에 없는 reviewer 등으로 강제 실패) → `failed` 상태 전이 확인

- [ ] **Step 11.7: 최종 커밋 (필요 시)**

만약 포맷 수정이 있었다면:

```bash
git -C /Users/leo/Desktop/sdadaniel/orchestation add -A
git -C /Users/leo/Desktop/sdadaniel/orchestation commit -m "style: 포맷 정리"
```

---

## Post-Plan Notes

- `ops/signal.ts`는 iTerm runner가 참조하므로 이번 플랜에서 **보존**. iTerm runner 정리 플랜에서 함께 삭제 후보.
- `retry-counts.json` 파일 기반 저장은 그대로. 후속 플랜에서 SQLite로 이관.
- `healthCheck`의 30분 타임아웃 하드코딩 유지. 후속 플랜에서 `settings.ts`로 이관.
- 이 리팩터가 크래시 내구성을 **개선하지 않음**. 오히려 시그널 파일이 재시작 시 흡수해주던 안전망이 사라지므로, 별도 "in_progress 크래시 복구" 플랜이 다음 우선순위.

---

## Self-Review

**Spec coverage:**
- ✅ 시그널 제거 (Task 6, 7, 8)
- ✅ 상태 전이 단일화 (Task 1-4)
- ✅ healthCheck/cleanupZombies 경로 통일 (Task 9)
- ✅ 폴링 지연 제거 (Task 8 결과)
- ✅ 테스트 (Task 5, 11)

**Placeholder scan:** 없음. 모든 코드 블록 실제 내용 포함.

**Type consistency:**
- `TransitionContext` (Task 1, 6) — 이름 일치
- `onTaskFinished`/`onReviewFinished` — Task 1 선언, Task 3/4 구현, Task 6/7 호출 — 일치
- `JobTaskResult`/`JobReviewResult` — `job-task.ts`/`job-review.ts`의 기존 export 재사용
- `markTaskFailed` — Task 2 export, Task 9 import — 일치
