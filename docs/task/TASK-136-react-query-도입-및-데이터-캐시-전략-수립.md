---
id: TASK-136
title: React Query 도입 및 데이터 캐시 전략 수립
status: done
branch: task/task-136
worktree: ../repo-wt-task-136
priority: high
created: 2026-03-25
updated: 2026-03-25
depends_on:
  - TASK-135
scope:
  - src/frontend/package.json
  - src/frontend/src/app/layout.tsx
  - src/frontend/src/lib/query-client.ts
  - src/frontend/src/hooks/**
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/app/tasks/page.tsx
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/cost/page.tsx
  - src/frontend/src/app/notices/page.tsx
  - src/frontend/src/app/monitor/page.tsx
---

## 목표
@tanstack/react-query를 도입하여 서버 상태 관리를 체계화. 캐시 전략을 적용하여 불필요한 refetch 제거, 낙관적 업데이트, 자동 재시도 등을 구현.

## 구현 범위

### 1. 설치 및 세팅
- `@tanstack/react-query` + `@tanstack/react-query-devtools` 설치
- `QueryClientProvider` 를 layout.tsx에 추가
- 글로벌 QueryClient 설정 (기본 staleTime, gcTime, retry 등)

### 2. 캐시 전략

| API | staleTime | refetchInterval | 전략 |
|-----|-----------|-----------------|------|
| `/api/requests` | 5s | SSE invalidation | SSE watch로 invalidate, 수동 fetch 최소화 |
| `/api/tasks` | 5s | SSE invalidation | 위와 동일 |
| `/api/orchestrate/status` | 0 (always fresh) | 2s (running) / 5s (idle) | 실시간성 중요, 조건부 polling |
| `/api/notices` | 30s | - | 자주 안 바뀜, 수동 invalidate |
| `/api/costs` | 60s | orchestration 완료 시 invalidate | 비용 데이터는 자주 안 바뀜 |
| `/api/run-history` | 60s | orchestration 완료 시 invalidate | 위와 동일 |
| `/api/requests/[id]` | 10s | - | 상세 페이지 진입 시 fresh fetch |
| `/api/tasks/[id]/logs` | 0 | 5s (in_progress만) | 실시간 로그 |
| `/api/monitor` | 0 | 1s | 실시간 모니터링 |
| `/api/prds` | 5min | - | 거의 안 바뀜 |
| `/api/docs` | 30s | - | 수동 mutation 후 invalidate |

### 3. 낙관적 업데이트
- 태스크 상태 변경 (status update) → UI 즉시 반영 → 실패 시 rollback
- 태스크 순서 변경 (reorder) → 즉시 반영 (기존 로직 유지)
- Notice 읽음 처리 → 즉시 반영

### 4. Query Key 설계
```
["requests"]           — 전체 태스크 목록
["requests", id]       — 태스크 상세
["tasks"]              — waterfall 그룹
["orchestration"]      — orchestration 상태
["notices"]            — 알림 목록
["costs"]              — 비용 데이터
["run-history"]        — 실행 이력
["monitor"]            — 시스템 모니터링
["docs"]               — 문서 트리
["prds"]               — PRD 목록
```

### 5. SSE Invalidation
- `/api/tasks/watch` SSE 이벤트 수신 시 관련 query invalidate
- 현재 2개 hook에서 중복 연결 → 1곳(QueryClient level)에서 관리

### 6. 기존 hook 마이그레이션
- `useRequests` → `useQuery` + `useMutation` 래퍼
- `useTasks` → `useQuery` 래퍼
- `useNotices` → `useQuery` + `useMutation` 래퍼
- `useCosts` → `useQuery` (orchestration query 구독)
- `useMonitor` → `useQuery` (refetchInterval: 1000)
- 기타 hook도 순차 전환

## Completion Criteria
- react-query 설치 + QueryClientProvider 세팅
- 위 캐시 전략 적용
- 기존 hook들 react-query 기반으로 전환
- React Query Devtools에서 캐시 상태 확인 가능
- 중복 SSE 연결 1개로 통합
- 기존 기능 모두 정상 동작
