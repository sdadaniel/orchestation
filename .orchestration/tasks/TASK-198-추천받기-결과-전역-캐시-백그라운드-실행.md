---
id: TASK-198
title: 추천받기 결과 전역 캐시 + 백그라운드 실행
status: done
branch: task/task-198
worktree: ../repo-wt-task-198
priority: high
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/tasks/new/page.tsx
  - src/frontend/src/store/suggestStore.ts
  - src/frontend/src/app/api/tasks/suggest/route.ts
---

## 현상
- 추천받기 결과가 useState로 관리 → 페이지 나가면 사라짐
- 추천 API 호출이 1~2분 걸리는데 페이지에 있어야 함
- 페이지 나갔다 오면 처음부터 다시 호출해야 함

## 수정 방향

### 1. zustand store로 전역 캐시
- suggestStore.ts 생성 — suggestions, loading, error 상태 관리
- 페이지 나갔다 와도 결과 유지
- 수동으로 "새로고침" 버튼 누를 때만 재호출

### 2. 백그라운드 실행
- 추천 API 호출을 store에서 관리
- 페이지를 나가도 호출이 계속 진행
- 돌아왔을 때 결과가 이미 있으면 바로 표시
- loading 중이면 진행 상태 표시

### 3. API 개선
- suggest API가 execSync(동기)로 호출 → 타임아웃 위험
- spawn(비동기)으로 변경하고 결과를 파일/메모리에 캐시

## Completion Criteria
- 페이지 나갔다 와도 추천 결과 유지
- 추천 진행 중 페이지 나가도 계속 실행
- 결과 캐시 + 수동 새로고침
