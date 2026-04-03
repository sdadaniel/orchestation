---
id: TASK-337
title: hooks-error-handling-중복-getErrorMessage-유틸-통합
status: failed
branch: task/task-337
worktree: ../repo-wt-task-337
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-03 11:20
depends_on: []
scope:
  - src/frontend/src/hooks/useRequests.ts
  - src/frontend/src/hooks/usePrds.ts
  - src/frontend/src/hooks/useRunHistory.ts
  - src/frontend/src/hooks/useDocTree.ts
  - src/frontend/src/hooks/useMonitor.ts
  - src/frontend/src/hooks/usePlanTree.ts
  - src/frontend/src/lib/error-utils.ts
---
6개 hooks 파일에서 `error instanceof Error ? error.message : "fallback"` 패턴이 7회 인라인 반복되고 있다.
이미 `src/frontend/src/lib/error-utils.ts`에 동일 목적의 `getErrorMessage()` 유틸이 존재하므로, 인라인 패턴을 유틸 호출로 대체한다.

현재 각 파일의 fallback 문자열이 제각각("오류 발생", "Error", "Unknown error", "알 수 없는 오류가 발생했습니다.")으로 불일치한다.
`getErrorMessage`의 기본값(`"알 수 없는 오류가 발생했습니다."`)으로 통일하거나, 의도적 차이가 있는 경우 두 번째 인자로 전달한다.

### 신규 기능 제안

`getErrorMessage` 유틸에 **에러 로깅 옵션**을 추가한다:
- `options.log?: boolean` — `true`일 때 `console.error`로 원본 에러 객체를 자동 출력
- hooks에서 반복되는 `catch(err) { console.error(err); setError(...) }` 패턴을 `setError(getErrorMessage(err, fallback, { log: true }))` 한 줄로 단축 가능

## Completion Criteria
- 6개 hooks 파일에서 인라인 `instanceof Error` 패턴 제거
- 각 파일에 `import { getErrorMessage } from "@/lib/error-utils"` 추가
- fallback 문자열 통일 (의도적 차이 시 두 번째 인자 활용)
- `getErrorMessage`에 `options.log` 파라미터 추가 (선택적 에러 로깅)
- TypeScript 컴파일 에러 없음
