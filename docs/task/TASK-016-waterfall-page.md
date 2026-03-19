---
id: TASK-016
title: 워터폴 페이지 통합
sprint: SPRINT-002
status: done
priority: critical
depends_on:
  - TASK-012
  - TASK-013
  - TASK-014
  - TASK-015
blocks: []
parallel_with: []
role: frontend-dev
branch: task/TASK-016-waterfall-page
worktree: ../repo-wt-TASK-016
reviewer_role: reviewer-general
affected_files:
  - src/frontend/app/page.tsx
  - src/frontend/hooks/
---

## 목표

모든 워터폴 컴포넌트를 조립하여 대시보드 메인 페이지에 통합한다.

## 무엇을

- `src/frontend/app/page.tsx` — 메인 페이지 업데이트
- `src/frontend/hooks/useTasks.ts` — Task/Sprint 데이터 fetch 훅

## 어떻게

- **데이터 흐름**:
  1. useTasks 훅에서 `/api/tasks` + `/api/sprints` 동시 fetch
  2. waterfall.ts 유틸로 `WaterfallGroup[]` 변환
  3. WaterfallContainer에 전달
- **상태 관리**: React useState로 선택된 Task 관리
- Task 바 클릭 → TaskDetailPanel 열기
- 에러/로딩 상태 처리 (shadcn Skeleton 활용)

## 입출력

- 입력: API 응답
- 출력: 완성된 워터폴 대시보드 페이지

## 완료 조건

- 페이지 로드 시 Sprint > Task 워터폴이 정상 렌더링됨
- Task 클릭 시 사이드 패널에 상세 정보 표시
- Sprint 접기/펼치기 정상 동작
- 로딩/에러 상태 처리됨
- `docs/task/`, `docs/sprint/` 파일 변경 후 새로고침 시 반영됨
