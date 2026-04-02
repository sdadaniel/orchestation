---
id: TASK-322
title: cost-parser-regex-match-배열-인덱스-타입-안전성-추가
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/lib/cost-parser.ts
---
`parseCostLogLine` 함수에서 regex match 결과(`matchWithModel[1]`~`matchWithModel[11]`, `matchLegacy[1]`~`matchLegacy[10]`)를 배열 인덱스로 직접 접근하여 `string | undefined`를 `string`이나 `parseInt`/`parseFloat` 인자로 전달하고 있음. `noUncheckedIndexedAccess` strict 옵션 기준 타입 불일치.

regex capture group 결과를 non-null assertion(`!`) 또는 `?? ""` / `?? "0"` 기본값으로 감싸서 타입 안전성 확보.

## Completion Criteria
- `matchWithModel[N]` 및 `matchLegacy[N]` 접근에 `?? ""` 또는 `?? "0"` 기본값 적용
- `npx tsc --noEmit --strict --noUncheckedIndexedAccess` 기준 `cost-parser.ts` 관련 에러 0건
- 기존 테스트(`cost-parser.test.ts`) 통과
