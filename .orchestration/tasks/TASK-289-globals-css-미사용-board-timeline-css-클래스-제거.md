---
id: TASK-289
title: globals.css 미사용 Board/Timeline CSS 클래스 제거
status: pending
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - src/frontend/src/app/globals.css
---
`globals.css`에 Board View(Kanban) 레이아웃 및 Timeline 관련 CSS 클래스가 정의되어 있으나, 어떤 `.tsx` 파일에서도 참조하지 않는 dead code이다.

**미사용 클래스 목록 (19개, ~100줄):**
- Board 레이아웃: `.board-container`, `.board-column`, `.board-column-header`, `.board-col-gray`, `.board-col-blue`, `.board-col-orange`, `.board-col-green`, `.board-column-count`, `.board-column-body` (lines 531-580)
- Board 상태: `.board-card-done`, `.board-card-rejected` (lines 788-793)
- Timeline: `.timeline-row`, `.timeline-header-row`, `.timeline-corner`, `.timeline-task-label`, `button.timeline-task-label:hover`, `.timeline-bars`, `.batch-column`, `.timeline-bar`, `.timeline-dep-arrow` (lines 612-696)

참고: `.board-card` 클래스는 4개 컴포넌트에서 사용 중이므로 유지한다.

## Completion Criteria
- 위 19개 미사용 CSS 클래스 정의를 `globals.css`에서 삭제
- `.board-card` 및 기타 사용 중인 클래스는 그대로 유지
- 프론트엔드 빌드(`npm run build`) 정상 통과
