---
id: NOTICE-1050
title: TASK-333 거절
type: warning
read: false
created: 2026-04-07
updated: 2026-04-07
---
**TASK-333:** 거절: scope 내 6개 hook 파일 모두 이미 `getErrorMessage`를 import하여 사용 중이며, `error-utils.ts`도 `defaultMessage` 파라미터가 이미 구현되어 있어 완료 조건이 전부 충족된 상태임.
