---
id: TASK-023
title: Plan 트리 뷰 컴포넌트
sprint: SPRINT-004
status: done
priority: high
depends_on:
  - TASK-021
blocks:
  - TASK-024
parallel_with:
  - TASK-022
role: frontend-dev
branch: task/TASK-023-plan-tree-components
worktree: ../repo-wt-TASK-023
reviewer_role: reviewer-general
affected_files:
  - src/frontend/src/components/plan/PlanTreeContainer.tsx
  - src/frontend/src/components/plan/PlanCard.tsx
  - src/frontend/src/components/plan/SprintNode.tsx
  - src/frontend/src/components/plan/TaskNode.tsx
---

## 목표

Plan → Sprint → Task 세로 트리 조감도를 구성하는 UI 컴포넌트들을 구현한다.

## 무엇을

- `src/frontend/src/components/plan/PlanTreeContainer.tsx` — 전체 트리 래퍼 (NEW)
- `src/frontend/src/components/plan/PlanCard.tsx` — 최상위 Plan 카드 (NEW)
- `src/frontend/src/components/plan/SprintNode.tsx` — Sprint 노드 카드 (NEW)
- `src/frontend/src/components/plan/TaskNode.tsx` — Task 노드 카드 (NEW)

## 어떻게

### 전체 레이아웃 구조 (세로 트리)

```
┌──────────────────────────────────┐
│         PlanCard (루트)            │
│  PLAN-001: 오케스트레이션 대시보드     │
│  ● in_progress                   │
└──────────────┬───────────────────┘
               │ (세로 연결선)
     ┌─────────┼──────────┐
     │         │          │
┌────▼───┐┌───▼────┐┌────▼───┐
│ SP-001 ││ SP-002 ││ SP-003 │     ← SprintNode (가로 배열)
│ 2/2 ✓  ││ 8/8 ✓  ││ 0/3    │
└────┬───┘└───┬────┘└────┬───┘
     │        │          │
  ┌──▼──┐ ┌──▼──┐   ┌───▼──┐
  │T-007│ │T-009│   │T-017 │     ← TaskNode (세로 나열)
  │T-008│ │T-010│   │T-018 │
  │     │ │... │   │T-019 │
  └─────┘ └─────┘   └──────┘
```

### 1. PlanTreeContainer

```tsx
// Props: { data: PlanTreeData, onTaskClick: (taskId: string) => void, onSprintClick: (sprintId: string) => void }
// 전체 트리를 감싸는 래퍼. 세로 중앙 정렬, 스크롤 지원
// PlanCard → 연결선 → SprintNode[] 배열 렌더링
```

- `overflow-auto` 로 가로/세로 스크롤 지원 (Sprint가 많을 때)
- 배경: 약간의 그리드 패턴 또는 단색 (`bg-muted/30`)

### 2. PlanCard (루트 카드)

```tsx
// Props: { plan: { id: string, title: string, status: PlanStatus } }
```

- **크기**: `w-72 px-6 py-4`
- **스타일**: `border-2 rounded-xl shadow-md bg-card`
- **내용**:
  - Plan ID (작은 뱃지, `text-xs text-muted-foreground`)
  - Plan Title (`text-lg font-semibold`)
  - Status 뱃지 (색상: `draft`=회색, `in_progress`=파랑, `done`=초록)
- **위치**: 트리 최상단 가로 중앙

### 3. SprintNode

```tsx
// Props: { sprint: PlanSprintNode, onClick: () => void }
```

- **크기**: `w-52 px-4 py-3`
- **스타일**: `border rounded-lg bg-card hover:shadow-md cursor-pointer transition-shadow`
- **내용**:
  - Sprint ID (`text-xs text-muted-foreground`)
  - Sprint Title (`text-sm font-medium`, 한 줄 truncate)
  - 진행률 바 (높이 4px, done=초록 / 남은=회색)
  - 진행률 텍스트 (`text-xs`, `2/8`)
  - 전체 완료 시 체크 아이콘 표시
- **클릭**: `onClick` 호출 (부모에서 워터폴 뷰로 네비게이션)

### 4. TaskNode

```tsx
// Props: { task: PlanTaskNode, onClick: () => void }
```

- **크기**: `w-44 px-3 py-2`
- **스타일**: `border rounded-md hover:bg-accent cursor-pointer transition-colors`
- **내용**:
  - Task ID (`text-xs text-muted-foreground`)
  - Task Title (`text-xs`, 한 줄 truncate)
  - Status 도트 (왼쪽, 기존 상태 색상 상수 재사용 — `constants.ts`의 `STATUS_COLORS`)
- **클릭**: `onClick` 호출 (부모에서 사이드 패널 열기)

### 5. 연결선

CSS `::before`/`::after` 의사 요소로 구현:
- PlanCard → SprintNode 그룹: 세로선 (PlanCard 하단 → SprintNode 그룹 상단)
- SprintNode → TaskNode 그룹: 세로선 (SprintNode 하단 → 첫 TaskNode 상단)
- 형제 SprintNode 간 가로선: SprintNode 그룹 상단에서 좌우로 연결

**연결선 스타일**: `border-border` 색상, 1px 두께

### 6. 사용할 기존 리소스

- `constants.ts`의 `STATUS_COLORS` — Task 상태 색상
- `shadcn/ui`의 `Badge` — 상태 뱃지
- `shadcn/ui`의 `Progress` — 진행률 바 (있으면 사용, 없으면 div로 직접 구현)

## 입출력

- 입력: `PlanTreeData` (TASK-021에서 정의한 타입)
- 출력: 세로 트리 조감도 UI

## 완료 조건

- PlanCard가 Plan 정보를 올바르게 표시함
- SprintNode가 Sprint별 진행률을 표시하고 클릭 가능함
- TaskNode가 상태 색상과 함께 표시되고 클릭 가능함
- 계층 간 연결선이 시각적으로 표현됨
- Sprint 수가 5개 이상일 때 가로 스크롤이 동작함
