---
id: TASK-281
title: frontmatter-utils 유닛 테스트 추가
status: pending
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - src/frontend/src/lib/frontmatter-utils.ts
  - src/frontend/src/lib/__tests__/frontmatter-utils.test.ts
---
`src/frontend/src/lib/frontmatter-utils.ts`에 대한 유닛 테스트가 전혀 없다. parseFrontmatter, getString, getBool, getInt, getStringArray 5개 함수 모두 순수 함수이며 테스트 작성이 용이하다.

## Completion Criteria
- `frontmatter-utils.test.ts` 파일 생성
- parseFrontmatter: 정상 파싱, 빈 문자열, 잘못된 입력 케이스
- getString: null/undefined fallback, Date→YYYY-MM-DD 변환, 빈 문자열 처리
- getBool: boolean/string/undefined 입력 처리
- getInt: number/string/NaN/undefined 입력 처리
- getStringArray: 배열/단일 문자열/빈값 입력 처리
- `npx vitest run frontmatter-utils` 통과
