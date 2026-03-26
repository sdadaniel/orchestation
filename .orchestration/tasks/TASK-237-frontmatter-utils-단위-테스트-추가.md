---
id: TASK-237
title: frontmatter-utils 단위 테스트 추가
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/frontmatter-utils.ts
  - src/frontend/src/lib/__tests__/frontmatter-utils.test.ts
---
`frontmatter-utils.ts`는 프로젝트 전역 파서(notice-parser, request-parser, prd-parser 등)에서 공통으로 사용하는 핵심 유틸리티이나 단위 테스트가 전혀 없음.

작성할 테스트:
- `parseFrontmatter`: 정상 YAML, 빈 문자열, 잘못된 YAML 입력 시 안전 반환
- `getString`: null/undefined → fallback, Date → "YYYY-MM-DD" 변환, 빈 문자열 → fallback
- `getBool`: boolean/string "true"/"false"/fallback 분기
- `getInt`: number/string/NaN → fallback 분기
- `getStringArray`: 배열, 단일 문자열, 빈 값 분기

## Completion Criteria
- vitest 기반 테스트 파일 `src/frontend/src/lib/__tests__/frontmatter-utils.test.ts` 생성
- 5개 함수(`parseFrontmatter`, `getString`, `getBool`, `getInt`, `getStringArray`) 각각 최소 3개 케이스 커버
- `npm test` (또는 `npx vitest run`) 전체 통과
