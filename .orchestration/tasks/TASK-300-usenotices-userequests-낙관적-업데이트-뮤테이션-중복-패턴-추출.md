---
id: TASK-300
title: useNotices/useRequests 낙관적 업데이트 뮤테이션 중복 패턴 추출
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
useNotices.ts와 useRequests.ts에서 동일한 optimistic update 뮤테이션 보일러플레이트(cancelQueries → getQueryData → setQueryData → onError rollback → onSettled invalidate)가 update/delete/reorder 등 6회 이상 복붙되어 있음.

공통 패턴을 유틸리티 훅(예: `useOptimisticMutation`)으로 추출하여 중복 제거.

## Completion Criteria
- onMutate(cancel → snapshot → optimistic set), onError(rollback), onSettled(invalidate) 공통 로직을 재사용 가능한 헬퍼로 추출
- useNotices.ts, useRequests.ts가 추출된 헬퍼를 사용하도록 리팩터링
- 기존 동작(낙관적 업데이트, 롤백, 캐시 무효화) 변경 없음
