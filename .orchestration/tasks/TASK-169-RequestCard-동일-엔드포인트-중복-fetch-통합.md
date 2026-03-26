---
id: TASK-169
title: RequestCard 동일 엔드포인트 중복 fetch 통합
status: pending
branch: task/task-169
worktree: ../repo-wt-task-169
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/RequestCard.tsx
---

## 문제

`RequestCard.tsx`의 useEffect(lines 46-63)에서 동일한 API 엔드포인트 `/api/requests/${req.id}`를 **두 번 개별 호출**하고 있다.

### 현재 코드 (lines 47-62)

```typescript
// 1차 호출: logs 탭 진입 시
if (cardTab === "logs" && execLog === null && !execLogLoading) {
  setExecLogLoading(true);
  fetch(`/api/requests/${req.id}`)
    .then(r => r.json())
    .then(data => setExecLog(data.executionLog ?? null))
    ...
}

// 2차 호출: review 탭 진입 시 — 동일 URL 재호출
if (cardTab === "review" && reviewResult === null && !reviewLoading) {
  setReviewLoading(true);
  fetch(`/api/requests/${req.id}`)
    .then(r => r.json())
    .then(data => setReviewResult(data.reviewResult ?? null))
    ...
}
```

### 영향

- 사용자가 logs 탭과 review 탭을 모두 방문하면 **동일 응답을 2번 요청** → 불필요한 네트워크 비용
- 두 호출의 응답 JSON은 동일한 객체이며, 각각 다른 필드만 추출하고 있음
- 하나의 fetch로 `executionLog`과 `reviewResult` 를 동시에 저장하면 호출 1회로 충분

## 수정 방안

- 두 조건부 블록을 하나로 통합: `(cardTab === "logs" || cardTab === "review")` 조건에서 한 번만 fetch
- 응답에서 `executionLog`과 `reviewResult`를 동시에 추출하여 각각의 state에 저장
- 기존 lazy-load 동작(탭 전환 시 최초 1회만 로드) 유지

## Completion Criteria

- `/api/requests/${req.id}` 호출이 컴포넌트 수명 중 최대 1회로 감소
- logs 탭, review 탭 모두 기존과 동일하게 데이터 표시
- TypeScript 빌드 에러 없음
