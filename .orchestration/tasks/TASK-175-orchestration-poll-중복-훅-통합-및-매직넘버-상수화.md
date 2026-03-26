---
id: TASK-175
title: orchestration poll 중복 훅 통합 및 폴링 간격 매직넘버 상수화
status: done
branch: task/task-175
worktree: ../repo-wt-task-175
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/hooks/useSprints.ts
  - src/frontend/src/hooks/useCosts.ts
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/components/TaskLogModal.tsx
  - src/frontend/src/components/AutoImproveControl.tsx
  - src/frontend/src/app/night-worker/page.tsx
---

## 문제

### 1. orchestration poll useEffect 완전 중복
`useSprints.ts`(line 93-107)와 `useCosts.ts`(line 62-76)에 동일한 orchestration 상태 폴링 `useEffect` 블록이 복사-붙여넣기 되어 있다.

```ts
// 두 파일에 동일하게 존재
useEffect(() => {
  const interval = setInterval(() => {
    fetch("/api/orchestrate/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "running") { refetch(); }
      })
      .catch(() => {});
  }, 5000);
  return () => clearInterval(interval);
}, [refetch]);
```

두 훅이 동시에 활성화되면 같은 엔드포인트에 SSE가 아닌 **이중 폴링** 연결이 발생한다.

### 2. 폴링 간격 매직넘버 산재
폴링 간격이 이름 없는 숫자 리터럴로 흩어져 있어 일괄 조정이 불가능하다.

| 파일 | 값 | 용도 |
|------|-----|------|
| `useSprints.ts:104` | `5000` | orchestration poll |
| `useCosts.ts:73` | `5000` | orchestration poll (중복) |
| `tasks/[id]/page.tsx:94` | `1500` | 로그 poll |
| `tasks/[id]/page.tsx:219` | `5000` | orchestration check |
| `tasks/[id]/page.tsx:262` | `2000` | run status poll |
| `TaskLogModal.tsx:57` | `3000` | 로그 poll (TaskLogTab의 5000과 불일치) |
| `AutoImproveControl.tsx:41` | `2000` | status poll |
| `night-worker/page.tsx:45` | `3000` | status poll |

## 작업 내용

1. `useOrchestrationPoll(onRunning: () => void)` 공통 훅 추출 — `useSprints`, `useCosts`에서 중복 `useEffect` 제거 후 공통 훅 호출로 교체
2. `src/frontend/src/lib/poll-constants.ts`에 폴링 간격 상수 정의 (예: `POLL_ORCHESTRATION_MS`, `POLL_TASK_LOGS_MS` 등)
3. 위 표의 각 파일에서 숫자 리터럴을 상수 import로 교체

## Completion Criteria

- `useSprints.ts`와 `useCosts.ts`의 orchestration poll `useEffect`가 공통 훅 1개로 통합됨
- 폴링 간격 매직넘버가 `poll-constants.ts` 상수로 교체됨 (scope 내 파일 전체)
- 기존 폴링 동작 변경 없음 (간격 값 유지)
