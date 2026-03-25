---
id: TASK-135
title: Zustand 전역 상태 마이그레이션 — Orchestration, Tasks, Notices
status: done
branch: task/task-135
worktree: ../repo-wt-task-135
priority: high
created: 2026-03-25
updated: 2026-03-25
depends_on:
  - TASK-133
scope:
  - src/frontend/src/store/**
  - src/frontend/src/hooks/useOrchestrationStatus.ts
  - src/frontend/src/hooks/useTasks.ts
  - src/frontend/src/hooks/useRequests.ts
  - src/frontend/src/hooks/useNotices.ts
  - src/frontend/src/hooks/useCosts.ts
  - src/frontend/src/hooks/useSprints.ts
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/components/sidebar.tsx
  - src/frontend/src/components/AutoImproveControl.tsx
  - src/frontend/src/app/tasks/page.tsx
  - src/frontend/src/app/cost/page.tsx
---

## 목표
현재 각 hook에서 독립적으로 관리되는 상태를 Zustand store로 통합하여 중복 polling 제거, prop drilling 해소, 단일 상태 소스 확립.

## 구현 범위

### 1. Orchestration Store (최우선)
- `/api/orchestrate/status` polling을 store 1곳에서만 수행
- `useOrchestrationStatus`, `useCosts`, `useSprints`에서 각각 하던 polling 제거
- `status`, `justFinished`, `clearFinished` 전역 관리
- AppShell, cost/page.tsx 등에서 store 직접 구독

### 2. Tasks/Requests Store
- `useTasks` + `useRequests` → 단일 store
- SSE watch 연결 1개로 통합 (현재 2개 중복)
- CRUD 액션 (create, update, delete, reorder) store에서 관리
- AppShell → TaskSidebar 12개+ prop drilling 제거

### 3. Notices Store
- `useNotices` → store
- 읽음/안읽음 상태 전역 관리
- sidebar에서 prop 없이 직접 접근

## 마이그레이션 전략
- 기존 hook을 store wrapper로 변환 (하위 호환 유지)
- 점진적 마이그레이션: store 생성 → hook을 store 래퍼로 → 직접 store 사용으로 전환
- devtools 미들웨어 활성화 (TASK-133에서 세팅 완료)

## Completion Criteria
- 중복 polling 제거 확인 (Network 탭에서 /api/orchestrate/status 호출 1개)
- AppShell prop drilling 50% 이상 감소
- 기존 기능 모두 정상 동작
- Redux DevTools에서 상태 변화 추적 가능
