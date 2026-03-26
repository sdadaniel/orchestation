---
id: TASK-173
title: waterfall VALID_STATUSES 불일치로 stopped/reviewing/rejected 태스크가 pending으로 표시되는 버그
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/lib/waterfall.ts
  - src/frontend/src/types/waterfall.ts
---

## 문제

`src/frontend/src/lib/waterfall.ts`의 `VALID_STATUSES` Set과 `WaterfallTaskStatus` 타입이 불일치하여, 특정 상태의 태스크가 waterfall 뷰에서 잘못된 상태(`pending`)로 표시된다.

### 현재 상태

**`VALID_STATUSES` (waterfall.ts:14-19)**
```ts
const VALID_STATUSES: Set<string> = new Set([
  "pending", "in_progress", "in_review", "done",
]);
```

**`WaterfallTaskStatus` (types/waterfall.ts:1-8)**
```ts
export type WaterfallTaskStatus =
  | "pending" | "stopped" | "in_progress"
  | "in_review" | "reviewing" | "done" | "rejected";
```

**`TaskStatus` (lib/constants.ts:2)** — UI 전체에서 사용하는 정규 상태:
```ts
export type TaskStatus = "pending" | "stopped" | "in_progress" | "reviewing" | "done" | "rejected";
```

### 문제점

1. `VALID_STATUSES`에 `stopped`, `reviewing`, `rejected`가 누락 → 해당 상태의 태스크가 `toWaterfallTask()`에서 `pending`으로 강제 변환됨 (waterfall.ts:30-32)
2. `VALID_STATUSES`에 `in_review`가 포함되어 있지만, 실제 시스템에서 사용하는 상태는 `reviewing`임 → 데드 코드
3. `task.status as WaterfallTaskStatus` (waterfall.ts:31) — unsafe type assertion. `VALID_STATUSES` 통과 후에도 `WaterfallTaskStatus`와 정확히 일치한다는 보장 없음

### 영향

- Waterfall 뷰에서 `stopped`, `reviewing`, `rejected` 태스크가 모두 `pending`으로 보임
- 사용자가 실제 상태를 파악할 수 없는 UI 버그

## 작업 내용

1. `VALID_STATUSES`를 `TaskStatus` 기준으로 동기화: `stopped`, `reviewing`, `rejected` 추가, `in_review` 제거
2. `WaterfallTaskStatus`에서 `in_review` 제거 (시스템에서 미사용) — 또는 `TaskStatus`를 직접 사용하도록 통합
3. `as WaterfallTaskStatus` unsafe cast 제거 — 타입 가드 또는 정확한 타입 매핑 사용

## Completion Criteria

- `stopped`, `reviewing`, `rejected` 상태의 태스크가 waterfall 뷰에서 올바른 상태로 표시됨
- `in_review` 데드 타입 제거
- `as WaterfallTaskStatus` unsafe type assertion 제거
- `tsc --noEmit` 통과
- 로직 변경 없음 — 타입 수정과 상수 동기화만 수행
