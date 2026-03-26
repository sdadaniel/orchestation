---
id: TASK-233
title: API-route-validStatuses-상수-불일치-분석-보고서
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/[id]/route.ts
  - src/frontend/lib/constants.ts
  - docs/todo/api-status-mismatch-audit.md
---

API route의 `validStatuses` 배열과 `constants.ts`의 `TaskStatus` 타입 간 불일치를 분석하고 `docs/todo/`에 보고서를 작성한다.

- `route.ts:52` → `["pending", "in_progress", "in_review", "done"]`
- `constants.ts:2` → `"pending" | "stopped" | "in_progress" | "reviewing" | "done" | "rejected"`
- `"in_review"` vs `"reviewing"` 명칭 불일치
- `"stopped"`, `"rejected"` 누락

## Completion Criteria
- `docs/todo/api-status-mismatch-audit.md` 분석 보고서 작성 완료
- 불일치 항목, 영향 범위, 수정 제안 포함
