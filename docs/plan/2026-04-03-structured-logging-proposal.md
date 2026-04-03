# 구조화 로깅 도입 제안

**작성일:** 2026-04-03
**상태:** 제안 (미구현)
**관련 태스크:** TASK-332

---

## 1. 현황 — console 사용 분포

### API Routes

| 파일 | console.error 건수 |
|------|--------------------|
| `src/app/api/chat/route.ts` | 2 |
| `src/app/api/tasks/suggest/route.ts` | 3 |
| `src/app/api/tasks/analyze/route.ts` | 3 |
| **합계** | **8** |

#### 상세 위치

**chat/route.ts** (2건)
- L92: `console.error("Claude CLI stderr:", stderrData)`
- L99: `console.error("Claude CLI spawn error:", err.message)`

**tasks/suggest/route.ts** (3건)
- L46: `console.error("Claude CLI stderr:", stderr)`
- L71: `console.error("Failed to parse suggest response:", stdout)`
- L83: `console.error("Claude CLI spawn error:", err.message)`

**tasks/analyze/route.ts** (3건)
- L94: `console.error("Claude CLI stderr:", stderr)`
- L169: `console.error("Failed to parse AI response:", stdout)`
- L194: `console.error("Claude CLI spawn error:", err.message)`

### server.ts

`console.*` 호출 17건 (`console.log`, `console.error`, `console.warn` 혼용).

---

## 2. 문제점

1. **환경 구분 없음** — 개발/프로덕션 동일한 출력. 프로덕션에서 민감 데이터(stdout 내용)가 로그에 노출될 수 있음.
2. **구조 없음** — 순수 문자열 출력. 로그 집계 도구(Datadog, CloudWatch 등)와 연동 불가.
3. **레벨 제어 없음** — 디버그 메시지를 끄거나 올릴 수 없음.
4. **추적 불가** — 요청 ID, taskId 등 컨텍스트가 메시지에 포함되지 않음.

---

## 3. 제안 아키텍처

### 3.1 logger.ts 유틸리티 생성

```typescript
// src/frontend/src/lib/logger.ts

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  process.env.LOG_LEVEL as LogLevel ??
  (process.env.NODE_ENV === "production" ? "warn" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function format(level: LogLevel, context: string, msg: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] [${context}] ${msg}`;
  return meta !== undefined ? `${base} ${JSON.stringify(meta)}` : base;
}

export const logger = {
  debug: (ctx: string, msg: string, meta?: unknown) => {
    if (shouldLog("debug")) console.debug(format("debug", ctx, msg, meta));
  },
  info: (ctx: string, msg: string, meta?: unknown) => {
    if (shouldLog("info")) console.info(format("info", ctx, msg, meta));
  },
  warn: (ctx: string, msg: string, meta?: unknown) => {
    if (shouldLog("warn")) console.warn(format("warn", ctx, msg, meta));
  },
  error: (ctx: string, msg: string, meta?: unknown) => {
    if (shouldLog("error")) console.error(format("error", ctx, msg, meta));
  },
};
```

### 3.2 API Route 마이그레이션 예시

**Before:**
```typescript
console.error("Claude CLI stderr:", stderrData);
```

**After:**
```typescript
import { logger } from "@/lib/logger";
// ...
logger.error("chat/route", "Claude CLI stderr", { stderr: stderrData });
```

### 3.3 server.ts 마이그레이션 예시

**Before:**
```typescript
console.log(`[ws:task-logs] connected for ${taskId}`);
console.error(`[ws:task-logs] error for ${taskId}: ${err.message}`);
```

**After:**
```typescript
import { logger } from "./src/lib/logger";
// ...
logger.info("ws:task-logs", `connected for ${taskId}`);
logger.error("ws:task-logs", `error for ${taskId}`, { message: err.message });
```

---

## 4. 마이그레이션 단계

| 단계 | 작업 | 파일 |
|------|------|------|
| 1 | `src/lib/logger.ts` 생성 | 신규 |
| 2 | API routes console 교체 (8건) | chat, suggest, analyze route.ts |
| 3 | server.ts console 교체 (17건) | server.ts |
| 4 | orchestrate-engine.ts `this.log()` 내부 console 확인 | orchestrate-engine.ts |
| 5 | `LOG_LEVEL` 환경변수 문서화 | README 또는 .env.example |

---

## 5. 환경변수

```
LOG_LEVEL=debug   # 개발 (기본값)
LOG_LEVEL=warn    # 프로덕션 (기본값)
LOG_LEVEL=error   # 에러만
```

---

## 6. 예상 효과

- 프로덕션에서 불필요한 debug/info 로그 억제
- 로그 집계 도구와 JSON 구조 연동 가능 (추후 JSON 포맷터 추가 시)
- 동일한 API 호출 흐름을 context 필드로 추적 가능
