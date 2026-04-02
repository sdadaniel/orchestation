---
id: TASK-306
title: CostTable-RunHistory-페이지네이션-정렬-중복코드-추출
status: in_progress
branch: task/task-306
worktree: ../repo-wt-task-306
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02 15:49
depends_on: []
scope:
  - src/frontend/src/components/cost/CostTable.tsx
  - src/frontend/src/components/cost/RunHistory.tsx
---
CostTable과 RunHistory에 페이지네이션 상태 관리, 정렬 헤더 렌더링, 페이지 번호 UI 블록이 70줄 이상 동일하게 복붙되어 있음.

- 페이지네이션 state 및 계산 로직 (currentPage, itemsPerPage, totalPages 등)
- `renderSortableHeader` 함수 (동일 구현)
- 페이지 번호 렌더링 UI 블록 (이전/다음 버튼 + 번호 리스트)
- `formatDuration` 유틸 함수 (미세 차이만 존재)

`usePaginatedTable` 훅 또는 공유 페이지네이션 컴포넌트로 추출하여 중복 제거.

## Completion Criteria
- 페이지네이션 상태 로직을 공유 훅(`usePaginatedTable`)으로 추출
- 정렬 헤더 렌더링을 공유 컴포넌트로 추출
- 페이지 번호 UI를 공유 `<Pagination>` 컴포넌트로 추출
- `formatDuration`을 단일 유틸 함수로 통합
- CostTable, RunHistory 모두 추출된 공유 코드를 사용하도록 리팩터링
- 기존 동작 변경 없음 확인
