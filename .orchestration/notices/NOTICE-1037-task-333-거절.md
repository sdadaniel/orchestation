---
id: NOTICE-1037
title: TASK-333 거절
type: warning
read: false
created: 2026-04-07
updated: 2026-04-07
---
**TASK-333:** 거절: 완료 조건이 이미 충족되어 있음 — 6개 hook 파일 모두 `getErrorMessage(error)` 를 import하여 사용 중이고, `error-utils.ts`의 `getErrorMessage`에도 선택적 `fallback` 파라미터(두 번째 인자)가 이미 존재함. 인라인 `error instanceof Error` 패턴 없음.
