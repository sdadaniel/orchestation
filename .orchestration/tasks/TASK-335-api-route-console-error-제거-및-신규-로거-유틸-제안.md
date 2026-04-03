---
id: TASK-335
title: api-route-console-error-제거-및-신규-로거-유틸-제안
status: pending
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-03
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/suggest/route.ts
  - src/frontend/src/app/api/tasks/analyze/route.ts
  - src/frontend/src/app/api/chat/route.ts
---
API 라우트 핸들러 3개 파일에서 `console.error()` 호출이 총 8건 존재한다.
프로덕션 API 라우트에서 console 문은 ESLint `no-console` 규칙 위반이며,
구조화된 로깅 없이 stderr로만 출력되어 운영 환경에서 추적이 불가능하다.

**현황 (8건)**
| 파일 | 라인 | 내용 |
|------|------|------|
| `suggest/route.ts` | 46 | `console.error("Claude CLI stderr:", stderr)` |
| `suggest/route.ts` | 71 | `console.error("Failed to parse suggest response:", stdout)` |
| `suggest/route.ts` | 83 | `console.error("Claude CLI spawn error:", err.message)` |
| `analyze/route.ts` | 94 | `console.error("Claude CLI stderr:", stderr)` |
| `analyze/route.ts` | 169 | `console.error("Failed to parse AI response:", stdout)` |
| `analyze/route.ts` | 194 | `console.error("Claude CLI spawn error:", err.message)` |
| `chat/route.ts` | 92 | `console.error("Claude CLI stderr:", stderrData)` |
| `chat/route.ts` | 99 | `console.error("Claude CLI spawn error:", err.message)` |

**수정 방안**
1. `console.error()` 호출을 모두 제거한다.
2. 에러 정보는 `NextResponse.json()` 응답 body에 이미 포함되므로 별도 로깅 불필요.
3. 향후 구조화된 로깅이 필요할 경우를 대비해 아래 신규 기능을 제안한다.

## 신규 기능 제안: 서버사이드 로거 유틸리티

`src/frontend/src/lib/logger.ts`에 경량 로거 유틸리티를 도입한다.

**목적**: console 직접 호출 대신 환경별(dev/prod) 로깅 레벨을 제어하고,
향후 외부 로깅 서비스(Sentry, Datadog 등) 연동 지점을 단일화한다.

**설계 개요**:
```typescript
type LogLevel = "debug" | "info" | "warn" | "error";
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === "production" ? "warn" : "debug");
export const logger = {
  debug: (msg, ...args) => shouldLog("debug") && console.debug(`[DEBUG] ${msg}`, ...args),
  info:  (msg, ...args) => shouldLog("info")  && console.info(`[INFO] ${msg}`, ...args),
  warn:  (msg, ...args) => shouldLog("warn")  && console.warn(`[WARN] ${msg}`, ...args),
  error: (msg, ...args) => shouldLog("error") && console.error(`[ERROR] ${msg}`, ...args),
};
```

**적용 시 장점**:
- ESLint `no-console` 규칙을 logger.ts 한 곳에만 예외 처리
- 프로덕션에서 debug/info 로그 자동 억제
- 외부 로깅 서비스 연동 시 변경 지점 단일화

## Completion Criteria
- [ ] 3개 API 라우트 파일에서 `console.error()` 8건 모두 제거
- [ ] 기존 에러 응답 로직(NextResponse.json)은 변경하지 않음
- [ ] `src/frontend/src/lib/logger.ts` 신규 유틸리티 파일 생성 및 문서화
- [ ] TypeScript 컴파일 에러 없음
