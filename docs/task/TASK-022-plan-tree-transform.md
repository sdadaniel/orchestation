---
id: TASK-022
title: Plan 트리 데이터 변환 유틸
sprint: SPRINT-004
status: backlog
priority: high
depends_on:
  - TASK-021
blocks:
  - TASK-024
parallel_with:
  - TASK-023
role: frontend-dev
branch: task/TASK-022-plan-tree-transform
worktree: ../repo-wt-TASK-022
reviewer_role: reviewer-general
affected_files:
  - src/frontend/src/lib/plan-tree.ts
  - src/frontend/src/hooks/usePlanTree.ts
---

## 목표

Plan API + Sprint API + Task API 응답을 조합하여 `PlanTreeData` 트리 구조로 변환하는 유틸과 데이터 패칭 훅을 구현한다.

## 무엇을

- `src/frontend/src/lib/plan-tree.ts` — 데이터 변환 함수 (NEW)
- `src/frontend/src/hooks/usePlanTree.ts` — Plan 트리 데이터 패칭 훅 (NEW)

## 어떻게

### 1. 변환 함수 (`plan-tree.ts`)

기존 `waterfall.ts` 패턴을 따른다.

```typescript
import type { PlanFrontmatter } from "@/lib/plan-parser";
import type { SprintData } from "@/lib/sprint-parser";
import type { TaskFrontmatter } from "@/lib/parser";
import type { PlanTreeData, PlanSprintNode, PlanTaskNode } from "@/types/plan";

export function buildPlanTree(
  plan: PlanFrontmatter,
  sprints: SprintData[],
  tasks: TaskFrontmatter[],
): PlanTreeData {
  // 1. plan.sprints 배열 순서대로 Sprint 매칭
  // 2. 각 Sprint의 tasks 배열로 Task 매칭
  // 3. Sprint별 progress 계산 (done 수 / 전체 수)
  // 4. PlanTreeData 구조로 반환
}
```

**변환 로직:**
1. `plan.sprints` 순서 유지 (`SPRINT-001`, `SPRINT-002`, ...)
2. 각 Sprint ID로 `sprints` 배열에서 매칭 → `SprintData.tasks`로 Task ID 목록 획득
3. Task ID로 `tasks` 배열에서 매칭 → `PlanTaskNode` 생성 (`id`, `title`, `status`, `priority`)
4. Sprint별 `progress`: `{ done: tasks.filter(t => t.status === "done").length, total: tasks.length }`
5. plan.sprints에 있지만 Sprint 파일이 없는 경우: `{ id, title: "(미정)", tasks: [], progress: { done: 0, total: 0 } }`

### 2. 데이터 패칭 훅 (`usePlanTree.ts`)

기존 `useTasks.ts` 패턴을 따른다.

```typescript
"use client";

import { useState, useEffect } from "react";
import type { PlanTreeData } from "@/types/plan";

export function usePlanTree() {
  // 1. /api/plans, /api/sprints, /api/tasks 동시 fetch (Promise.all)
  // 2. plans[0] (첫 번째 Plan)을 기준으로 buildPlanTree 호출
  // 3. { data: PlanTreeData | null, loading: boolean, error: string | null } 반환
}
```

## 입출력

- 입력: `/api/plans`, `/api/sprints`, `/api/tasks` API 응답
- 출력: `PlanTreeData` 객체
  ```json
  {
    "plan": { "id": "PLAN-001", "title": "오케스트레이션 대시보드", "status": "in_progress" },
    "sprints": [
      {
        "id": "SPRINT-001",
        "title": "프로젝트 셋업 + 데이터 파싱",
        "tasks": [
          { "id": "TASK-007", "title": "Next.js 프로젝트 초기화", "status": "done", "priority": "critical" },
          { "id": "TASK-008", "title": "Task frontmatter 파싱 API", "status": "done", "priority": "critical" }
        ],
        "progress": { "done": 2, "total": 2 }
      }
    ]
  }
  ```

## 완료 조건

- `buildPlanTree()` 가 Plan, Sprint, Task 데이터를 올바르게 트리로 조합함
- Sprint 순서가 Plan frontmatter의 `sprints` 배열 순서와 일치함
- Sprint에 속한 Task가 올바르게 매핑됨
- `usePlanTree()` 훅이 로딩/에러/데이터 상태를 올바르게 반환함
