---
id: TASK-343
title: task-log-parser regex match 배열 인덱스 타입 안전성 추가
status: done
branch: task/task-343
worktree: ../repo-wt-task-343
priority: medium
mode: night
created: 2026-04-06
updated: 2026-04-11 08:19
depends_on: []
scope:
  - src/frontend/src/lib/task-log-parser.ts
---
`noUncheckedIndexedAccess` 활성화 시 `task-log-parser.ts`에서 regex match 결과의 캡처 그룹 인덱스 접근이 `string | undefined`로 추론되어 4건의 타입 에러 발생.

- 라인 83: `timestampMatch[1]` → `string | undefined`를 `string`에 할당
- 라인 216: `tsMatch[1]` → `string | undefined`를 `string`에 할당
- 라인 217: `tsMatch[2]` → `string | undefined`를 `string`에 할당
- 라인 219: `msg`가 `string | undefined`이므로 `{ timestamp, level, message: msg }` 할당 불가

각 regex match 인덱스 접근에 `?? ""` fallback 또는 non-null assertion을 추가하여 타입 안전성 확보.

## Completion Criteria
- `npx tsc --noEmit --strict --noUncheckedIndexedAccess` 실행 시 `task-log-parser.ts` 관련 에러 0건
- 런타임 로직 변경 없음 (fallback 값만 추가)
