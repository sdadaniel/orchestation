---
id: NOTICE-150
title: TASK-290 거절
type: warning
read: true
created: 2026-03-30
updated: 2026-03-31
---
**TASK-290:** cost-parser.ts 중복 PROJECT_ROOT 선언을 공용 paths 모듈로 교체\n\n거절: cost-parser.ts가 이미 `@/lib/paths`에서 `PROJECT_ROOT`를 import하고 있으며, 로컬 중복 선언이 없어 완료 조건이 충족됨
