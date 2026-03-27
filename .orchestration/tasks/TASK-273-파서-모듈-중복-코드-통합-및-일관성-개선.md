---
id: TASK-273
title: 파서 모듈 중복 코드 통합 및 일관성 개선
status: pending
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:  []
---

4개 파서 파일이 동일한 패턴(readFile → parseFrontmatter → validate → return)을 반복하고 있으며, `plan-parser.ts`만 `gray-matter`를 직접 사용하고 나머지는 `frontmatter-utils`를 사용하는 비일관성도 확인됨. TASK-273은 빈 reserved 파일이므로 이 ID를 사용하겠습니다.

---
id: TASK-273
title: 파서 모듈 중복 코드 통합 및 일관성 개선
status: pending
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/lib/notice-parser.ts
  - src/frontend/src/lib/plan-parser.ts
  - src/frontend/src/lib/prd-parser.ts
  - src/frontend/src/lib/request-parser.ts
---
notice-parser, plan-parser, prd-parser, request-parser 4개 파일이 동일한 구조(readFile → frontmatter 파싱 → 검증 → 반환, parseAll → readdirSync → filter → parse each → sort, findFile → readdirSync → find)를 반복하고 있다.

추가로 plan-parser만 `gray-matter`를 직접 사용하고 나머지 3개는 `frontmatter-utils`의 `parseFrontmatter`를 사용하여 비일관적이다.

**작업 내용:**
1. plan-parser.ts의 `gray-matter` 직접 사용을 `frontmatter-utils`의 `parseFrontmatter`로 교체하여 일관성 확보
2. 4개 파서에서 반복되는 `parseAll` / `findFile` 패턴을 제네릭 헬퍼 함수로 추출 (예: `createDirParser<T>(dir, prefix, parseFn)`)
3. 기존 export API(함수명, 타입)는 변경하지 않음

## Completion Criteria
- plan-parser.ts가 `gray-matter` 대신 `frontmatter-utils`를 사용
- parseAll/findFile 중복 로직이 공통 헬퍼로 추출됨
- 기존 테스트 및 import가 깨지지 않음
- `npm run build` 성공

## Completion Criteria


