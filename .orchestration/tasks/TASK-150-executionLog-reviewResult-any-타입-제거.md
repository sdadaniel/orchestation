---
id: TASK-150
title: "executionLog/reviewResult Record<string, any>를 구체 인터페이스로 교체"
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/components/RequestCard.tsx
---

`TaskDetail` 인터페이스와 `RequestCard` 컴포넌트에서 `eslint-disable @typescript-eslint/no-explicit-any`로 억제된 `Record<string, any>` 4건을 구체 인터페이스로 교체한다.

### 현황 (4건)

| 파일 | 줄 | 현재 타입 |
|------|-----|-----------|
| `tasks/[id]/page.tsx` | 33 | `executionLog: Record<string, any>` |
| `tasks/[id]/page.tsx` | 35 | `reviewResult: Record<string, any>` |
| `RequestCard.tsx` | 29 | `useState<Record<string, any> \| null>` (execLog) |
| `RequestCard.tsx` | 32 | `useState<Record<string, any> \| null>` (reviewResult) |

### 수정 방법

사용처 분석 기반으로 다음 인터페이스를 정의하고 적용:

```typescript
interface ExecutionLog {
  subtype?: string;
  num_turns?: number;
  duration_ms?: number;
  total_cost_usd?: number;
  result?: string;
}

interface ReviewResult {
  subtype?: string;
  result?: string;
}
```

- `Record<string, any>` → `ExecutionLog` / `ReviewResult`로 교체
- 각 `eslint-disable-next-line` 주석 제거
- API 라우트(`api/requests/[id]/route.ts`)는 이미 `Record<string, unknown>`을 사용하므로 변경 불필요

### 주의

- 로직 변경 없음. 타입 어노테이션만 교체
- 프로퍼티 접근 시 `undefined` 체크가 이미 존재하므로 런타임 동작 변경 없음

## Completion Criteria
- 4건의 `eslint-disable @typescript-eslint/no-explicit-any` 주석 제거됨
- `Record<string, any>` → 구체 인터페이스로 교체됨
- `npx tsc --noEmit` 통과
- 기존 동작 변경 없음
