---
id: TASK-342
title: 배열-인덱스-접근-타입-안전성-추가
status: failed
branch: task/task-342
worktree: ../repo-wt-task-342
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-03 12:49
depends_on: []
scope:
  - src/frontend/src/app/tasks/new/page.tsx
  - src/frontend/src/app/api/requests/[id]/reorder/route.ts
  - src/frontend/tsconfig.json
---
`noUncheckedIndexedAccess` 기준으로 배열 인덱스 접근 시 `undefined` 가능성을 무시하는 코드가 존재한다.

### 주요 위치

1. **`src/frontend/src/app/tasks/new/page.tsx:58`**
   - `suggestions[idx]`가 `Suggestion | undefined`일 수 있으나, null 체크 없이 `.description`, `.category`, `.effort`, `.title`, `.priority`, `.scope` 접근
   - `selectedSuggestions`(Set<number>)의 인덱스가 `suggestions` 배열 범위를 벗어날 경우 런타임 에러 발생 가능

2. **`src/frontend/src/app/api/requests/[id]/reorder/route.ts:39,43,47,50,51`**
   - `siblings[swapIdx]`가 bounds check(line 35) 이후이지만 타입상 `| undefined`
   - `siblings[i]`, `siblings[idx]`, `siblings[swapIdx]` 모두 미검증 인덱스 접근

### 수정 방안
- 각 배열 인덱스 접근 후 `if (!item) return/continue` 가드 추가
- `tsconfig.json`에 `"noUncheckedIndexedAccess": true` 추가를 **신규 기능으로 제안** (별도 문서 참조)

## Completion Criteria
- `suggestions[idx]` 접근 전 `if (!s) continue` 가드 추가
- `siblings[swapIdx]` 접근 전 undefined 가드 추가
- 기존 동작 변경 없음 (로직 변경 금지)
