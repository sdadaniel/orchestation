---
id: TASK-132
title: 전역 상태 관리 통합 (useRequests 등 중복 인스턴스 제거)
status: failed
branch: task/task-132
worktree: ../repo-wt-task-132
priority: high
scope:
  - src/frontend/src/hooks/useRequests.ts
  - src/frontend/src/hooks/useTasks.ts
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/components/AutoImproveControl.tsx
  - src/frontend/src/components/RunningIndicator.tsx
  - src/frontend/src/app/tasks/page.tsx
  - src/frontend/src/app/requests/page.tsx
depends_on: []
---

## TASK-132: 전역 상태 관리 통합

### 배경
현재 `useRequests()` 훅이 AppShell, tasks page, requests page에서 **각각 별도 인스턴스**로 호출되어 동일한 데이터를 3번 fetch하고, 한쪽에서 업데이트해도 다른 쪽에 즉시 반영되지 않는 문제가 있다.

### 현재 문제점
- `useRequests()`가 3곳에서 독립 인스턴스로 동작 → 동일 API 3중 호출
- AppShell의 RunningIndicator가 tasks page의 상태 변경을 즉시 반영하지 못함
- AutoImproveControl의 Run/Stop이 task의 in_progress 상태와 불일치
- `useTasks()`도 AppShell + tasks page에서 이중 호출
- SSE 연결도 인스턴스별로 중복 생성

### 현재 전역 데이터 현황
| Hook | 데이터 | 호출 위치 | 갱신 방식 |
|---|---|---|---|
| `useRequests()` | task 목록 | AppShell, tasks page, requests page (3중) | SSE + 수동 refetch |
| `useTasks()` | waterfall 그룹 | AppShell, tasks page (2중) | SSE 디바운스 |
| `useDocTree()` | 문서 트리 | AppShell | fetch |
| orchestrate status | Run/Stop 상태 | AutoImproveControl | 2초 폴링 |

### 목표
React Context 또는 Zustand를 사용하여 전역 상태를 단일 인스턴스로 관리하고, 모든 컴포넌트가 동일한 데이터 소스를 참조하도록 통합한다.

### 완료 조건
- [ ] `useRequests` 데이터를 전역 Provider/Store로 통합 (단일 SSE 연결)
- [ ] `useTasks` 데이터를 전역 Provider/Store로 통합
- [ ] AppShell, tasks page, requests page가 동일 인스턴스 참조
- [ ] RunningIndicator가 task 상태 변경 즉시 반영
- [ ] AutoImproveControl이 task in_progress 상태와 동기화
- [ ] API 중복 호출 제거 (3중 → 1회)
- [ ] SSE 연결 중복 제거
