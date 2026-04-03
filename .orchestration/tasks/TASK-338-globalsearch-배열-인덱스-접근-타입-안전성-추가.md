---
id: TASK-338
title: GlobalSearch 배열 인덱스 접근 타입 안전성 추가
status: pending
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-03
depends_on: []
scope:
  - src/frontend/src/components/GlobalSearch.tsx
---
`noUncheckedIndexedAccess` strict 옵션 기준으로 `GlobalSearch.tsx`에서 배열 인덱스 접근 시 `undefined` 가능성을 처리하지 않는 타입 오류 2건 존재.

### 오류 상세

1. **Line 113**: `docMatch[1]` — regex match 결과 배열의 인덱스 접근이 `string | undefined`를 반환하지만 `string`으로 사용
2. **Line 165**: `results[activeIndex]` — `navigate()` 호출 시 `SearchResultItem | undefined`를 `SearchResultItem`으로 전달

### 수정 방안

1. Line 113: `docMatch[1]`에 nullish coalescing 추가 (`docMatch[1] ?? ''`)
2. Line 165: `results[activeIndex]` 접근 후 `undefined` 체크 가드 추가

### 신규 기능 제안

GlobalSearch에 **최근 검색어 히스토리** 기능 추가 제안 → `docs/plan/2026-04-03-globalsearch-recent-history-feature.md` 문서화 완료

## Completion Criteria
- `npx tsc --noEmit --noUncheckedIndexedAccess` 실행 시 `GlobalSearch.tsx` 관련 오류 0건
- 기존 동작(검색, 키보드 네비게이션)에 변경 없음
- 신규 기능 제안 문서 작성 완료
