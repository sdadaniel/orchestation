---
id: TASK-345
title: CostTable-RunHistory-formatDuration-중복-유틸-추출
status: done
branch: task/task-345
worktree: ../repo-wt-task-345
priority: medium
mode: night
created: 2026-04-06
updated: 2026-04-07 04:56
depends_on: []
scope:
  - src/frontend/src/components/cost/CostTable.tsx
  - src/frontend/src/components/cost/RunHistory.tsx
  - src/frontend/src/lib/format-utils.ts
---
CostTable.tsx(26행)과 RunHistory.tsx(17행)에 `formatDuration(ms: number): string` 함수가 중복 정의되어 있다. CostTable 버전은 분까지, RunHistory 버전은 시간까지 처리하며 앞부분 로직이 동일하다.

공용 유틸리티 모듈(format-utils.ts)로 추출하고 두 파일에서 import하여 사용한다.

## Completion Criteria
- formatDuration 함수를 공용 유틸리티 파일로 추출
- RunHistory 버전(시간 포함) 기준으로 통합
- CostTable.tsx와 RunHistory.tsx에서 중복 함수 제거 후 import 사용
- 기존 동작 변경 없음 확인
