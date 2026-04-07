---
id: NOTICE-1031
title: TASK-333 거절
type: warning
read: false
created: 2026-04-07
updated: 2026-04-07
---
**TASK-333:** 거절: 6개 hook 파일 모두 이미 `getErrorMessage()` 사용 중이며, `error instanceof Error` 인라인 패턴이 존재하지 않음. `getErrorMessage`도 이미 `fallback` 두 번째 파라미터를 보유하고 있어 완료 조건 전부 충족된 상태임.
