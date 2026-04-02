---
id: TASK-303
title: useNotices-useRequests-낙관적-업데이트-뮤테이션-중복-패턴-추출
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/hooks/useNotices.ts
  - src/frontend/src/hooks/useRequests.ts
---
`useNotices`와 `useRequests` 훅에서 낙관적 업데이트 뮤테이션(수정/삭제)의 구조가 거의 동일하게 반복된다.

두 훅 모두 동일한 패턴을 사용:
- `onMutate`: cancelQueries → getQueryData → setQueryData(낙관적 반영) → return previousData
- `onError`: previousData로 롤백
- `onSettled`: invalidateQueries

이 패턴이 update/delete 각각에서 반복되어 총 4곳(useNotices 2곳 + useRequests 2곳)에 복붙 코드가 존재한다.

공통 낙관적 뮤테이션 팩토리 유틸(`createOptimisticMutation` 등)을 추출하여 중복을 제거한다.

## Completion Criteria
- 낙관적 업데이트+롤백+invalidation 패턴을 공통 유틸 함수로 추출
- `useNotices`, `useRequests` 두 훅이 공통 유틸을 사용하도록 리팩터링
- 기존 동작(낙관적 반영, 에러 롤백, 쿼리 무효화) 변경 없음
- 기존 테스트 통과 확인
