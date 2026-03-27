---
id: TASK-267
title: requests API route 내 slug 생성 로직 중복 제거
status: rejected
branch: task/task-267
worktree: ../repo-wt-task-267
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/app/api/requests/[id]/route.ts
---
`src/frontend/src/app/api/requests/[id]/route.ts` PUT 핸들러에서 slug 생성 로직이 동일하게 2회 반복됨 (155행, 167행).

155행에서 이미 `slug` 변수에 할당한 값을 167행에서 동일한 체이닝(`trim().toLowerCase().replace(…).replace(…)`)으로 재계산하고 있음. DRY 위반이며 가독성 저하.

167행의 인라인 slug 재계산을 155행에서 생성한 `slug` 변수와 `newPath`를 재사용하도록 수정.

## Completion Criteria
- 167행의 인라인 slug 재계산이 제거되고 기존 `slug` 변수 또는 `newPath`를 재사용
- 기존 동작(파일 rename + 응답 반환)이 변경 없이 유지됨
