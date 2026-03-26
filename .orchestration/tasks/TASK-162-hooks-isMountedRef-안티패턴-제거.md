---
id: TASK-162
title: hooks isMountedRef 안티패턴 제거
status: in_progress
branch: task/task-162
worktree: ../repo-wt-task-162
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/hooks/useRequests.ts
  - src/frontend/src/hooks/useNotices.ts
---

## 문제

`useRequests`와 `useNotices` 훅에서 `AbortController`와 `isMountedRef` 패턴을 동시에 사용하고 있다. `isMountedRef`는 React 18 이전의 레거시 패턴으로, `AbortController`가 이미 fetch 취소와 상태 업데이트 방어를 처리하므로 중복이다.

### 구체적 위치

**useRequests.ts**
- L21: `isMountedRef` 선언
- L36, L45, L49, L76, L108, L121, L129, L162: `isMountedRef.current` 체크 (총 8곳)
- L56: `isMountedRef.current = true` 설정
- L60: `isMountedRef.current = false` 설정

**useNotices.ts**
- L19: `isMountedRef` 선언
- L33, L39, L43, L67, L78, L84: `isMountedRef.current` 체크 (총 6곳)
- L50: `isMountedRef.current = true` 설정
- L53: `isMountedRef.current = false` 설정

### 문제점

1. **중복 방어**: AbortController가 이미 fetch abort를 처리하므로 isMountedRef는 불필요
2. **false security**: isMountedRef 체크와 setState 호출 사이에 미세한 레이스 컨디션 존재
3. **코드 복잡도 증가**: 모든 setState 호출마다 guard 체크가 필요해 가독성 저하
4. **레거시 패턴**: React 공식 문서에서도 더 이상 권장하지 않는 방식

## 수정 방향

- `isMountedRef` 관련 코드 전부 제거 (선언, 설정, 체크)
- `AbortController`만으로 언마운트 안전성 유지
- `createRequest`, `updateRequest`, `deleteRequest` 등 mutation 콜백에서는 guard 불필요 (호출 시점에 컴포넌트가 마운트 상태)

## Completion Criteria

- [ ] useRequests.ts에서 isMountedRef 관련 코드 전부 제거
- [ ] useNotices.ts에서 isMountedRef 관련 코드 전부 제거
- [ ] AbortController 기반 cleanup은 유지
- [ ] 기존 기능(fetch, SSE 갱신, CRUD) 정상 동작 확인
