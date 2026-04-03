---
id: TASK-334
title: orchestrate-engine-require-http-implicit-any-수정
status: pending
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-03
depends_on: []
scope:
  - src/frontend/src/lib/orchestrate-engine.ts
---

`src/frontend/src/lib/orchestrate-engine.ts:761`에서 `const http = require("http")`를 사용하여 `http` 변수가 implicit `any` 타입이 된다. strict 모드 기준 타입 안전성이 깨지며, `http.request()` 호출 시 파라미터 타입 검증이 이루어지지 않는다.

파일 상단에 `import http from "http"`로 교체하고, 메서드 내 동적 `require()` 호출을 제거한다.

신규 기능 제안: `docs/plan/2026-04-03-task-execution-timeout.md`에 태스크 실행 타임아웃 기능을 문서화했다. 현재 엔진에 워커 타임아웃이 없어 장시간 실행 워커가 슬롯을 영구 점유할 수 있는 문제를 해결하는 제안이다.

## Completion Criteria
- `require("http")` 제거, 파일 상단 `import http from "http"` 으로 교체
- `npx tsc --noEmit --strict` 오류 없음
- 기존 동작(localhost:3000 POST /api/notices) 변경 없음
