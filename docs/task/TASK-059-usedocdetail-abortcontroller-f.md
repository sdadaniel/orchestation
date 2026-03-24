---
id: TASK-059
title: useDocDetail AbortController로 fetch 경쟁 조건 수정
status: in_progress
priority: high
sprint:
depends_on: []
branch: task/TASK-059-usedocdetail-abortcontroller-f
worktree: ../repo-wt-TASK-059
role: general
reviewer_role: reviewer-general
---

# TASK-059: useDocDetail AbortController로 fetch 경쟁 조건 수정

## 원본 요청

- Request: REQ-025
- 제목: useDocDetail fetch 순서 보장
- 내용: useDocDetail 훅에서 ID가 빠르게 변경될 때 이전 fetch 응답이 나중에 도착하면 잘못된 문서가 표시됨.

## 문제
- `hooks/useDocTree.ts:106-131`
- AbortController 미사용으로 이전 요청 취소 불가
- ID A → ID B 전환 시, A 응답이 B 이후 도착하면 A 내용이 표시됨

## Completion Criteria
- AbortController로 이전 fetch 취소 구현
- ID 변경 시 항상 최신 ID의 응답만 반영

## 완료 조건

- `hooks/useDocTree.ts` 106-131 라인의 fetch 로직에 AbortController 추가
- useEffect cleanup에서 `abort()` 호출하여 이전 요청 취소
- ID 변경 시 이전 fetch가 응답해도 state 업데이트 안 되도록 처리
- 빠른 ID 전환 시 항상 마지막 ID의 응답만 반영됨을 확인
