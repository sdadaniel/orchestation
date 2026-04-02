---
id: TASK-317
title: notices-route-매직-배열-중복-제거
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/app/api/notices/route.ts
---
`route.ts` 파일 내에서 유효 notice type 배열이 두 번 선언되어 있다.

- **19행**: `const VALID_NOTICE_TYPES = ["info", "warning", "error", "request"] as const;` (toNoticeType 함수에서 사용)
- **65행**: `const validTypes = ["info", "warning", "error", "request"];` (POST 핸들러에서 재선언)

동일한 값이 두 곳에 하드코딩되어 있어 타입 추가/변경 시 한쪽만 수정될 위험이 있다(DRY 위반). 65행의 로컬 변수를 제거하고 이미 정의된 `VALID_NOTICE_TYPES` 상수를 재사용하도록 수정한다.

## Completion Criteria
- 65행의 `validTypes` 로컬 변수 제거
- 66행에서 `VALID_NOTICE_TYPES`를 사용하도록 변경
- 기존 동작(유효하지 않은 type → "info" 폴백)이 그대로 유지됨
