---
id: TASK-340
title: API-route-JSON-에러-응답-중복-유틸-추출-및-신규-기능-제안
status: pending
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-03
depends_on: []
scope:
  - src/frontend/src/lib/error-utils.ts
  - src/frontend/src/app/api/tasks/analyze/route.ts
  - src/frontend/src/app/api/chat/route.ts
---
## 코드 품질 이슈

API route 파일에서 동일한 JSON 에러 응답 생성 패턴이 10회 반복됨:

```typescript
return new Response(JSON.stringify({ error: "..." }), {
  status: 400,
  headers: { "Content-Type": "application/json" },
});
```

- `src/frontend/src/app/api/tasks/analyze/route.ts` — 8회
- `src/frontend/src/app/api/chat/route.ts` — 2회

### 수정 방안

`src/frontend/src/lib/error-utils.ts`에 `jsonErrorResponse` 유틸 함수를 추가하고, 기존 10곳을 해당 유틸 호출로 교체한다.

```typescript
export function jsonErrorResponse(error: string, status = 400): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

## 신규 기능 제안

### jsonErrorResponse 유틸 확장 — 구조화된 에러 응답

단순 에러 메시지 외에 `code`, `details` 등 구조화된 필드를 포함하는 확장 버전을 제안한다:

```typescript
interface ApiErrorOptions {
  error: string;
  status?: number;
  code?: string;       // 예: "INVALID_INPUT", "TIMEOUT"
  details?: unknown;   // 디버깅용 추가 정보
}

export function jsonErrorResponse(opts: string | ApiErrorOptions, status = 400): Response {
  const body = typeof opts === "string"
    ? { error: opts }
    : { error: opts.error, ...(opts.code && { code: opts.code }), ...(opts.details && { details: opts.details }) };
  const finalStatus = typeof opts === "string" ? status : (opts.status ?? status);
  return new Response(JSON.stringify(body), {
    status: finalStatus,
    headers: { "Content-Type": "application/json" },
  });
}
```

이렇게 하면 향후 API 에러 응답에 에러 코드 기반 프론트엔드 핸들링, 디버그 정보 전달 등이 가능해진다.

## Completion Criteria
- [ ] `error-utils.ts`에 `jsonErrorResponse` 유틸 함수 추가
- [ ] `analyze/route.ts`의 8개 중복 패턴을 유틸 호출로 교체
- [ ] `chat/route.ts`의 2개 중복 패턴을 유틸 호출로 교체
- [ ] TypeScript 타입 체크 통과 (`npx tsc --noEmit`)
- [ ] 신규 기능 제안 문서가 태스크 본문에 포함됨
