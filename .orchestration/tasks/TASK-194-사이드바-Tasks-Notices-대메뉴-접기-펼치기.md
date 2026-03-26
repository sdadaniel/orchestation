---
id: TASK-194
title: 사이드바 Tasks/Notices 대메뉴 접기/펼치기 (Docs와 동일 패턴)
status: in_progress
branch: task/task-194
worktree: ../repo-wt-task-194
priority: high
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/components/sidebar.tsx
---

## 현상
- Docs 대메뉴는 ChevronDown/Right로 접기/펼치기 가능
- Tasks, Notices 대메뉴는 접기/펼치기 없이 하위 항목이 항상 노출되거나 개별 태스크만 접기 가능
- 대메뉴 헤더 클릭 시 접기/펼치기가 아니라 페이지 이동만 됨

## 수정 방향
- Tasks, Notices 헤더에 ChevronDown/Right 아이콘 추가
- 아이콘 클릭 → 하위 목록 접기/펼치기
- 헤더 텍스트 클릭 → 페이지 이동 (기존 유지)
- Docs 대메뉴와 동일한 UX 패턴

## Completion Criteria
- Tasks 대메뉴 접기/펼치기 동작
- Notices 대메뉴 접기/펼치기 동작
- Docs와 동일한 UX
- 접힌 상태에서도 갯수 뱃지 표시
