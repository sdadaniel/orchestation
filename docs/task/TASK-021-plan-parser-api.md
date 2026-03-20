---
id: TASK-021
title: Plan frontmatter 정의 + 파싱 API Route + 타입 정의
sprint: SPRINT-004
status: done
priority: critical
depends_on: []
blocks:
  - TASK-022
  - TASK-023
parallel_with:
  - TASK-020
role: backend-dev
branch: task/TASK-021-plan-parser-api
worktree: ../repo-wt-TASK-021
reviewer_role: reviewer-general
affected_files:
  - docs/plan/dashboard.md
  - src/frontend/src/lib/plan-parser.ts
  - src/frontend/src/app/api/plans/route.ts
  - src/frontend/src/types/plan.ts
---

## 목표

Plan 파일에 frontmatter를 추가하고, 파싱 API를 구현한다. Plan 뷰에서 사용할 타입도 함께 정의한다.

## 무엇을

- `docs/plan/dashboard.md` — frontmatter 추가 (MODIFY)
- `src/frontend/src/lib/plan-parser.ts` — Plan 파싱 로직 (NEW)
- `src/frontend/src/app/api/plans/route.ts` — Plan API 엔드포인트 (NEW)
- `src/frontend/src/types/plan.ts` — Plan 뷰 타입 정의 (NEW)

## 어떻게

### 1. Plan frontmatter 정의

`docs/plan/dashboard.md` 상단에 frontmatter 추가:

```yaml
---
id: PLAN-001
title: 오케스트레이션 대시보드
status: done
sprints:
  - SPRINT-001
  - SPRINT-002
  - SPRINT-003
  - SPRINT-004
---
```

본문(목표, 단계)은 그대로 유지.

### 2. Plan 파서 (`plan-parser.ts`)

기존 `parser.ts` (gray-matter) 패턴을 따른다:

```typescript
import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface PlanFrontmatter {
  id: string;
  title: string;
  status: string;
  sprints: string[];
}

const PLANS_DIR = path.join(process.cwd(), "../../docs/plan");

export function parsePlanFile(filePath: string): PlanFrontmatter | null {
  // gray-matter로 frontmatter 파싱
  // id, title 필수 — 없으면 null 반환
}

export function parseAllPlans(): PlanFrontmatter[] {
  // PLANS_DIR의 모든 .md 파일을 파싱
}
```

### 3. API Route (`/api/plans`)

```typescript
// GET /api/plans → PlanFrontmatter[]
import { NextResponse } from "next/server";
import { parseAllPlans } from "@/lib/plan-parser";

export async function GET() {
  const plans = parseAllPlans();
  return NextResponse.json(plans);
}
```

### 4. 타입 정의 (`types/plan.ts`)

Plan 트리 뷰에서 사용할 전체 타입:

```typescript
export type PlanStatus = "draft" | "in_progress" | "done";

export type PlanTaskNode = {
  id: string;
  title: string;
  status: string;    // backlog | in_progress | in_review | done
  priority: string;
};

export type PlanSprintNode = {
  id: string;
  title: string;
  tasks: PlanTaskNode[];
  progress: { done: number; total: number };
};

export type PlanTreeData = {
  plan: {
    id: string;
    title: string;
    status: PlanStatus;
  };
  sprints: PlanSprintNode[];
};
```

## 입출력

- 입력: `docs/plan/*.md` 파일
- 출력: `GET /api/plans` → `PlanFrontmatter[]`
  ```json
  [
    {
      "id": "PLAN-001",
      "title": "오케스트레이션 대시보드",
      "status": "in_progress",
      "sprints": ["SPRINT-001", "SPRINT-002", "SPRINT-003", "SPRINT-004"]
    }
  ]
  ```

## 완료 조건

- `GET /api/plans` 호출 시 Plan 목록이 JSON으로 반환됨
- `docs/plan/dashboard.md`에 frontmatter가 추가되어 있음
- `src/frontend/src/types/plan.ts`에 `PlanTreeData`, `PlanSprintNode`, `PlanTaskNode` 타입이 정의됨
- 기존 API (`/api/tasks`, `/api/sprints`)에 영향 없음
