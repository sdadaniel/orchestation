---
id: TASK-249
title: frontmatter-utils 유닛 테스트 작성
status: in_progress
branch: task/task-249
worktree: ../repo-wt-task-249
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27 06:22:09
depends_on: []
scope: []
---
TASK-249 is empty/reserved. TASK-243 covered parser/cost-parser/notice-parser but failed. `frontmatter-utils.ts` is a different, untested pure-function module used across the codebase.

---
id: TASK-249
title: frontmatter-utils 유닛 테스트 작성
status: failed
branch: task/task-249
worktree: ../repo-wt-task-249
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/frontmatter-utils.ts
  - src/frontend/vitest.config.ts
---
`frontmatter-utils.ts`는 프로젝트 전역에서 사용되는 순수 유틸리티 모듈이나 유닛 테스트가 전혀 없음.
`parseFrontmatter`, `getString`, `getBool`, `getInt`, `getStringArray` 5개 함수에 대해 테스트를 작성한다.

- `parseFrontmatter`: 정상 YAML frontmatter 파싱, 빈 문자열, 잘못된 형식 처리
- `getString`: null/undefined fallback, Date→"YYYY-MM-DD" 변환, 빈 문자열 처리
- `getBool`: boolean/string "true"/"false", 잘못된 타입 fallback
- `getInt`: 정수/문자열 파싱, NaN fallback, 소수점 truncate
- `getStringArray`: 배열/단일 문자열/빈 값 처리

## Completion Criteria
- `src/frontend/src/lib/__tests__/frontmatter-utils.test.ts` 생성 및 최소 15개 테스트 케이스
- Vitest unit 테스트 프로젝트 설정 추가 (현재 storybook만 설정됨)
- `npx vitest run` 실행 시 전체 통과
- 기존 코드 로직 변경 없음
