---
id: TASK-333
title: hooks-error-handling-중복-getErrorMessage-유틸-통합
status: in_progress
branch: task/task-333
worktree: ../repo-wt-task-333
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-12 03:20
depends_on: []
scope:
  - src/frontend/src/hooks/usePrds.ts
  - src/frontend/src/hooks/useRunHistory.ts
  - src/frontend/src/hooks/useMonitor.ts
  - src/frontend/src/hooks/useRequests.ts
  - src/frontend/src/hooks/usePlanTree.ts
  - src/frontend/src/hooks/useDocTree.ts
  - src/frontend/src/lib/error-utils.ts
---
## 문제

`error instanceof Error ? error.message : "..."` 인라인 패턴이 7개 hook 파일에 중복되어 있다.
이미 `src/frontend/src/lib/error-utils.ts`에 `getErrorMessage()` 유틸이 존재하고
`useTasks`, `useNotices`, `useCosts`는 올바르게 사용 중이나, 나머지 hook들은 인라인 패턴을 사용한다.

또한 각 파일마다 fallback 메시지가 "오류 발생", "알 수 없는 오류가 발생했습니다.", "Unknown error", "Error" 등으로 불일치한다.

## 수정 내용

1. 위 6개 hook 파일에서 인라인 `error instanceof Error ? error.message` 패턴을 `getErrorMessage(error)`로 교체
2. `getErrorMessage` import 추가
3. fallback 메시지를 유틸 함수에 위임하여 일관성 확보

## 신규 기능 제안

`getErrorMessage` 유틸에 선택적 `defaultMessage` 파라미터를 추가하여, 호출처별로 커스텀 fallback 메시지를 지정할 수 있게 한다:
```typescript
export function getErrorMessage(error: unknown, defaultMessage = "오류가 발생했습니다."): string
```

이를 통해 유틸 통합 후에도 컨텍스트에 맞는 fallback 메시지를 유지할 수 있다.

## Completion Criteria
- 6개 hook 파일의 인라인 error instanceof 패턴이 모두 getErrorMessage() 호출로 교체됨
- getErrorMessage에 선택적 defaultMessage 파라미터 추가됨
- 기존 getErrorMessage 호출처(useTasks, useNotices, useCosts)가 정상 동작함
- TypeScript 타입 체크 통과
