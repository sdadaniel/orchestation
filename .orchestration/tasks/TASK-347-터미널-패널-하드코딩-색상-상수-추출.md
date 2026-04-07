---
id: TASK-347
title: 터미널-패널-하드코딩-색상-상수-추출
status: done
branch: task/task-347
worktree: ../repo-wt-task-347
priority: medium
mode: night
created: 2026-04-06
updated: 2026-04-07 05:02
depends_on: []
scope:  []
---

기존 태스크에 없는 새 이슈입니다. TASK-348로 생성합니다.

---
id: TASK-348
title: 터미널-패널-하드코딩-색상-상수-추출
status: pending
priority: medium
mode: night
created: 2026-04-06
updated: 2026-04-06
depends_on: []
scope:
  - src/frontend/src/components/task-detail/CompletedLogPanel.tsx
  - src/frontend/src/components/task-detail/LiveLogPanel.tsx
  - src/frontend/src/components/task-detail/LiveTerminalPanel.tsx
---
CompletedLogPanel, LiveLogPanel, LiveTerminalPanel 3개 파일에서 터미널 배경색 `bg-[#0d1117]`과 헤더 배경색 `bg-[#161b22]`이 하드코딩으로 중복 사용됨.

매직 색상값을 Tailwind CSS 변수 또는 공통 상수로 추출하여 중복 제거.

## Completion Criteria
- `#0d1117`, `#161b22` 하드코딩 색상이 공통 상수 또는 Tailwind 커스텀 클래스로 추출됨
- 3개 파일 모두 추출된 상수/클래스를 참조하도록 변경됨
- 기존 렌더링 결과에 변화 없음

## Completion Criteria


