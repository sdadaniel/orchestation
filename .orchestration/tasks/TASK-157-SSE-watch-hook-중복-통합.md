---
id: TASK-157
title: useTasks·useRequests SSE watch 로직 공통 훅으로 추출
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/hooks/useTasks.ts
  - src/frontend/src/hooks/useRequests.ts
---

## 문제

`useTasks.ts`(L71-99)와 `useRequests.ts`(L67-98)에 거의 동일한 SSE 연결·디바운스·재연결 로직이 중복되어 있다.

```typescript
// 두 파일 모두 동일한 패턴
let es: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const debouncedRefetch = () => { /* ... */ };
const connect = () => {
  es = new EventSource("/api/tasks/watch");
  es.onmessage = (e) => { if (e.data === "changed") debouncedRefetch(); };
  es.onerror = () => { es?.close(); reconnectTimer = setTimeout(connect, 2000); };
};
connect();
```

차이점은 `debouncedRefetch` 내부에서 호출하는 콜백(`refetch` vs `fetchRequests`)과 `isMountedRef` 가드 유무뿐이다.

## 제안

`useSSEWatch(url, onChanged)` 같은 공통 훅을 추출하여 두 훅에서 재사용한다.

- `url`: SSE 엔드포인트 (현재 둘 다 `/api/tasks/watch`)
- `onChanged`: 변경 감지 시 호출할 콜백
- 디바운스(1000ms)·재연결(2000ms) 로직을 내부에 캡슐화
- cleanup 로직도 훅 내부에서 처리

## Completion Criteria

- [ ] `useSSEWatch` (또는 유사 이름) 공통 훅이 존재한다
- [ ] `useTasks.ts`와 `useRequests.ts`가 공통 훅을 사용하며 SSE 관련 인라인 코드가 제거되었다
- [ ] 기존 동작(디바운스·재연결·cleanup)이 동일하게 유지된다
- [ ] TypeScript 컴파일 에러 없음
