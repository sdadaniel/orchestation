---
id: TASK-331
title: task-detail-page-미사용-변수-제거
status: pending
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-03
depends_on: []
scope:
  - src/frontend/src/app/tasks/[id]/page.tsx
---
`src/frontend/src/app/tasks/[id]/page.tsx` 154번 줄에서 `const data = await res.json().catch(() => ({}))` 선언 후 `data` 변수를 사용하지 않음.

`--noUnusedLocals` strict 옵션에서 TS6133 오류 발생:
```
src/app/tasks/[id]/page.tsx(154,15): error TS6133: 'data' is declared but its value is never read.
```

해당 블록은 `!res.ok` 분기에서 응답을 읽기만 하고 결과를 사용하지 않으므로, `data` 변수 할당을 제거하고 `await res.json().catch(() => {})` 형태로 변경하거나 해당 줄 자체를 제거한다.

## Completion Criteria
- `const data` 미사용 변수 제거 또는 `_` prefix 적용
- `npx tsc --noEmit --strict --noUnusedLocals` 기준 해당 파일 오류 0건

## Feature Proposal
- 신규 기능 제안 문서: `docs/plan/2026-04-03-strict-typecheck-enforcement.md`
- 내용: `noUnusedLocals` + `noUnusedParameters` tsconfig 옵션 활성화로 미사용 변수 유입 사전 차단
