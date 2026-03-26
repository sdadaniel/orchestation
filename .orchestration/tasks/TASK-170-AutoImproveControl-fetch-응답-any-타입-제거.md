---
id: TASK-170
title: "AutoImproveControl fetch 응답 any 타입 제거"
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/AutoImproveControl.tsx
---

`AutoImproveControl.tsx`에서 3개의 `res.json()` 호출이 `any` 타입을 반환하여, 이후 `data.status`, `data.exitCode`, `data.error` 등의 속성 접근에 타입 안전성이 없는 문제.

### 현황 (3건)

| 줄 | fetch 대상 | 접근하는 속성 |
|----|-----------|-------------|
| 20 | `GET /api/orchestrate/status` | `data.status`, `data.exitCode` |
| 50 | `POST /api/orchestrate/run` | `data.error` |
| 68 | `POST /api/orchestrate/stop` | `data.error` |

`res.json()`이 `Promise<any>`를 반환하므로, `data.status`에 오타가 있거나 존재하지 않는 속성을 접근해도 컴파일 타임에 감지할 수 없다.

### 수정 방향

1. API 응답 타입 인터페이스를 컴포넌트 파일 상단에 정의:

```typescript
interface OrchestrationStatusResponse {
  status: RunStatus;
  exitCode?: number | null;
}

interface OrchestrationActionResponse {
  error?: string;
}
```

2. 각 `res.json()` 호출에 타입 어노테이션 적용:
   - Line 20: `const data: OrchestrationStatusResponse = await res.json();`
   - Line 50: `const data: OrchestrationActionResponse = await res.json();`
   - Line 68: `const data: OrchestrationActionResponse = await res.json();`

3. 로직 변경 없이 타입 어노테이션만 추가

## Completion Criteria
- 3개의 `res.json()` 반환값에 명시적 타입이 지정되어 `any` 전파가 없을 것
- `npx tsc --noEmit` 통과
- 기존 동작에 변경 없음 (로직 수정 금지)
