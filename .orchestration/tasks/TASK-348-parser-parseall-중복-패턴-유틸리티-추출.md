---
id: TASK-348
title: parser-parseAll-중복-패턴-유틸리티-추출
status: in_progress
branch: task/task-348
worktree: ../repo-wt-task-348
priority: medium
mode: night
created: 2026-04-06
updated: 2026-04-10 07:55
depends_on: []
scope:
  - src/frontend/src/lib/parser.ts
  - src/frontend/src/lib/plan-parser.ts
  - src/frontend/src/lib/prd-parser.ts
  - src/frontend/src/lib/request-parser.ts
  - src/frontend/src/lib/notice-parser.ts
---
5개 parser 파일에 거의 동일한 `parseAll*()` 함수가 반복됨.
공통 패턴: 디렉토리 존재 확인 → readdirSync → .md 필터 → 개별 parse → 배열 push → 반환.

`parseAllFromDirectory<T>(dir, parseFn, filterFn?, sortFn?)` 제네릭 유틸리티를 추출하고, 각 parser의 parseAll 함수를 이 유틸리티 호출로 교체한다.

## Completion Criteria
- 제네릭 `parseAllFromDirectory` 유틸리티 함수 1개 생성
- 5개 parser 파일의 parseAll 함수가 유틸리티를 사용하도록 교체
- 기존 동작(필터, 정렬 등) 동일하게 유지
- TypeScript 타입 체크 통과
