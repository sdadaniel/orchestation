---
title: Task failed/rejected/stopped 시 Retry 전략
created: 2026-05-05
updated: 2026-05-05
---

## 배경

이 시스템에서 엔진은 `tasks.status`만 보고 실행을 시작하지 않는다.
`task_steps`에서 **다음 `pending` step**을 찾아(`getNextPendingStep`) 그 step을 `in_progress`로 올리면서 실행을 시작한다.

`getNextPendingStep`의 정렬 규칙(`packages/engine/src/service/task-store.ts`):
1. `created ASC`
2. `step_type` 우선순위: `task` → `review` → `check` → 기타
3. `step_key ASC`

또한 `failed`로 종료된 태스크는 `markTaskFailed`가 다음을 함께 수행한다 (`packages/engine/src/orchestrate/core/task-transitions.ts`):
- `cleanupWorktreeAndBranch`로 **worktree와 branch를 삭제**
- `stopDependents`로 의존 태스크들을 **재귀적으로 `stopped`로 변경** (단, 변경 시점에 `pending` 상태였던 것만)

따라서 실패한 태스크를 다시 실행하려면, **`tasks.status`를 `pending`으로 되돌리는 것만으로는 동작하지 않는다.**
- `task_steps`가 모두 `failed/done`이면 “실행할 step 없음” 상태가 되어 엔진이 디스패치하지 못함
- worktree/branch가 이미 삭제된 상태라 작업 공간이 없음
- dependents는 `stopped`로 남아 후속 실행이 막힘

## 원칙

- **Retry는 “같은 taskId를 유지”**한다. (새 task 복제하지 않음)
- **Retry는 “단일 액션”**으로 수행한다. (status만 수동 변경 금지)
- Retry는 아래의 **리셋 규칙을 원자적으로** 적용해야 한다.

## Retry 실행 전제 조건

- 태스크의 현재 상태가 `failed` / `rejected` / `stopped` 중 하나일 때만 Retry 가능
- `in_progress` / `reviewing`일 때는 Retry 대신 Stop을 먼저 수행
- `depends_on`이 있는 경우, 선행 태스크가 모두 `done`이어야 한다 (엔진의 dispatch 규칙과 일치)
- `MAX_TASK_COST` 초과로 failed 된 경우, Retry 후 다시 비용이 누적되어 즉시 failed 될 수 있음을 UI에 경고 (비용 카운터는 끊어주지 않음, 아래 “비용 정책” 참고)

## Retry 리셋 규칙 (필수)

Retry 액션은 **하나의 트랜잭션**에서 아래를 모두 수행한다.

### 1) Task 상태/Phase

- `tasks.status`: `pending`으로 설정 (`updateTaskStatus`로 변경하여 `task_events.status_change` 이벤트 남김)
- `tasks.phase`: `NULL`로 초기화

### 2) Step 상태 (전체 리셋)

워크플로를 처음부터 다시 돌리기 위해 **모든 step을 `pending`으로 되돌린다.**

대상: 해당 태스크의 모든 `task_steps` 행 (step_type 무관)

각 step에 대해:
- `status` → `pending`
- `started_at` → `NULL`
- `finished_at` → `NULL`
- `attempt` → **`0`으로 리셋** (review retry 카운터를 새 시도 기준으로 다시 시작)
- `max_attempts` → 변경하지 않음

이벤트: 각 step 리셋마다 `task_events.step_reset` 이벤트를 남겨 “자동 review-retry 리셋”과 “사용자 명시적 Retry”를 추적할 수 있게 한다.

> 참고: 엔진의 자동 review retry 흐름(`handleReviewStepFinished`)은 work step만 `pending`으로 되돌리고 `attempt`를 증가시키는 별개 메커니즘이다. 사용자 Retry는 “워크플로 전체를 처음부터”라는 멘탈모델로 동작하므로 자동 review retry와 충돌하지 않는다.

### 3) Worktree / Branch 재생성

`failed` 태스크는 worktree/branch가 이미 삭제된 상태일 수 있다. Retry 액션은 다음을 보장한다.

- 새 worktree를 생성하고 `tasks.worktree`를 갱신
- 새 branch를 생성하고 `tasks.branch`를 갱신
- 기존 잔여 worktree/branch가 남아 있다면 정리 후 재생성

> `rejected` / `stopped`에서 worktree가 살아 있다면 재사용해도 된다. 정책은 “있으면 재사용, 없으면 재생성”.

### 4) Dependents 재활성화 (재귀)

해당 태스크에 (재귀적으로) 의존하는 모든 `stopped` 상태 태스크를 `pending`으로 되돌린다.

- 재귀 처리: A → B 의존, X → A 의존이고 B를 Retry 하면 A, X 모두 재활성화 (대칭적으로 `stopDependents`가 재귀이므로 동일하게 재귀)
- **`stopped`의 출처는 구분하지 않는다.** 의존 실패로 자동 stopped 된 것이든, 사용자가 직접 stop 한 것이든 모두 함께 깨운다.
  - 의도: 운영 단순함 우선. 구분이 필요하면 UI에서 Retry 시 “다음 dependents도 함께 재활성화됩니다” 확인 다이얼로그로 보완.
- 재활성화 대상은 `stopped`만이다. `failed` / `rejected` / `done` / `in_progress` 인 dependents는 건드리지 않는다.

### 5) 실행 산출물 / 로그 정리

Retry 전에 아래 산출물을 “이전 시도” 잔재로 남기지 않는다 (UI 혼선 방지).

- 결과 파일: `output/{taskId}-task.json`, `output/{taskId}-review.json`
- 거절 사유 / 피드백 파일: `output/{taskId}-rejection-reason.txt`, `output/{taskId}-review-feedback.txt`
- 로그: `output/logs/*.log` — 보존하되 향후 `run_id` prefix 도입 권장 (현재는 새 시도 시 append 또는 별도 처리 정책을 운영에 맞게 결정)

### 6) 비용 정책

- 누적 비용 카운터(`task_cost_log` 또는 동등 소스)는 **건드리지 않는다.** Retry 해도 누적 그대로.
- `MAX_TASK_COST` 초과 검사는 그대로 동작한다 (`isCostOverLimit`). 즉 Retry 후 새 비용이 추가되어 상한을 넘으면 다시 자동 failed.
- 의도: 무한 Retry 안전망. 사용자가 명시적으로 Retry 하더라도 비용 상한이 최종 cap 역할.

### 7) 이벤트 기록 요약

Retry 액션 1회마다 `task_events`에 남겨야 할 항목:

- `task_retry` (1건) — 누가 / 언제 / 직전 상태(`failed`/`rejected`/`stopped`)
- `status_change` (1건) — 직전 상태 → `pending`
- `step_reset` (N건) — 리셋된 각 step
- `dependents_reactivated` (M건, 있을 때만) — 함께 재활성화된 dependents 목록

이를 통해 “자동 review-retry로 인한 step 변경”과 “사용자 Retry로 인한 step 변경”을 타임라인에서 명확히 구분할 수 있다.

## Retry UX / 운영 규칙

- **Stop은 `pending`으로 되돌리지 않는다.** Stop은 의미상 `stopped`. `pending`은 “실행 대기”로 예약.
- “failed → pending” 단순 status 변경은 허용하더라도, 단독으로는 실행되지 않을 수 있음을 UI에 명시한다.
  - 권장: status 드롭다운에서 `pending` 선택 시 “Retry 액션 사용” 안내 또는 자동 처리.
- Retry 다이얼로그에는 다음을 표시한다:
  - 함께 재활성화될 dependents 목록
  - 누적 비용과 `MAX_TASK_COST` 잔여
  - 리셋될 step 수

## 다른 옵션과의 비교

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **1. 같은 Task에서 Retry (채택)** | 같은 `taskId`로 step 전체 리셋 후 재실행 | 기록 연속성, 단순 멘탈모델 | 자동 review-retry와의 의미 분리 필요 |
| 2. Task 복제 (Clone) | 새 `taskId`로 복제 후 실행, 원본은 history로 보존 | 시도별 격리, 비용·attempt 카운터 자연 분리 | task 목록 복잡, dependents 재배선 부담 |
| 3. 부분 재실행 | 실패 step만 골라 `pending` | 비용·시간 절약 | 중간 상태 일관성 보장 어려움, 사용자 인지 부담 |

옵션 1을 채택한 이유: 운영 단순함, 기록 연속성, 사용자가 “이 태스크를 다시” 라는 직관과 일치. 비용/카운터 분리는 비용 누적 유지 + MAX cap 정책으로 보완 가능.

## 현재 구현 상태 / 알려진 갭

- **Retry 미구현**: 본 문서가 정의한 Retry 액션은 아직 구현되어 있지 않다.
  - Engine: `retryTask(taskId)` 함수 없음
  - Gateway RPC: `task.retry` 없음 (`task.run`, `task.status`, `task.stop`만 존재 — `packages/gateway/src/rpc/methods/task-runs.ts`)
  - Dashboard API: `/api/tasks/[id]/retry` 라우트 없음
  - Dashboard UI: Retry 버튼 없음
- **Worktree 생성 유틸 부재**: worktree 생성 로직은 `packages/engine/src/orchestrate/jobs/job-task.ts`의 `ensureWorktree`에 인라인되어 있다. Retry 구현 시 이 함수를 재사용하거나 공용 유틸로 승격 필요.
- **Stop 버튼 정책 위반 (수정 필요)**: 현재 `packages/dashboard/src/views/tasks/components/RequestCard.tsx`의 Stop 버튼은 단순히 `onUpdate(req.id, { status: "pending" })`로 status를 `pending`으로 바꾼다. 본 문서의 “Stop은 `pending`으로 되돌리지 않는다” 규칙에 위배되며, `task.stop` RPC를 호출해 `stopped`로 변경하도록 수정해야 한다. Retry 구현과 함께 정리한다.
- **DB event_type 추가 필요**: `task_events.event_type`에 현재 `status_change`, `dispatch`, `review_start`, `review_result`, `merge`, `signal`만 사용된다 (`packages/engine/src/service/schema.sql`). Retry 구현 시 `task_retry`, `step_reset`, `dependents_reactivated` 추가 (또는 generic `detail`로 처리할지 구현 단계에서 결정).

## 관측 / 디버깅 가이드

Retry 후에도 실행이 안 되면 아래를 확인한다.

- `task_steps`에 `pending` step이 존재하는지 (전체 리셋이 트랜잭션으로 적용됐는지)
- `tasks.status`가 `pending`인지
- `tasks.worktree`, `tasks.branch`가 갱신됐고 실제 디스크/git에 존재하는지
- `depends_on`이 모두 `done`인지
- `scope` 충돌 또는 parallel slot 제한으로 계속 스킵되고 있지 않은지
- `MAX_TASK_COST` 잔여가 남아 있는지

`task_events`에서 `task_retry`, `status_change`, `step_reset`, `step_start/step_end` 이벤트 타임라인을 보면 “누가 언제 어떤 변경을 일으켰는지”(수동/자동)를 추적할 수 있다.
