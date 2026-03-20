---
id: TASK-024
title: Plan 페이지 통합 + 사이드바 Plan 탭 활성화
sprint: SPRINT-004
status: backlog
priority: critical
depends_on:
  - TASK-022
  - TASK-023
blocks: []
parallel_with: []
role: frontend-dev
branch: task/TASK-024-plan-page-integration
worktree: ../repo-wt-TASK-024
reviewer_role: reviewer-general
affected_files:
  - src/frontend/src/app/plan/page.tsx
  - src/frontend/src/components/sidebar.tsx
---

## 목표

Plan 트리 뷰 컴포넌트들을 `/plan` 페이지로 조립하고, 사이드바의 Plan 탭을 활성화하여 네비게이션을 완성한다.

## 무엇을

- `src/frontend/src/app/plan/page.tsx` — Plan 페이지 (NEW)
- `src/frontend/src/components/sidebar.tsx` — Plan 탭 활성화 (MODIFY)

## 어떻게

### 1. Plan 페이지 (`/plan`)

기존 워터폴 페이지(`page.tsx`) 패턴을 따른다:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlanTree } from "@/hooks/usePlanTree";
import { PlanTreeContainer } from "@/components/plan/PlanTreeContainer";
import { TaskDetailPanel } from "@/components/waterfall/TaskDetailPanel";

export default function PlanPage() {
  // 1. usePlanTree() 로 데이터 패칭
  // 2. 로딩 상태: Skeleton 또는 "로딩 중..." 표시
  // 3. 에러 상태: 에러 메시지 표시
  // 4. 정상 상태: PlanTreeContainer 렌더링
  // 5. Task 클릭 → TaskDetailPanel (기존 사이드 패널 컴포넌트 재사용)
  // 6. Sprint 클릭 → router.push("/") 로 워터폴 뷰로 이동
  //    (향후 특정 Sprint로 스크롤하는 기능은 이 Sprint 스코프 밖)
}
```

**Task 사이드 패널 연동:**
- `usePlanTree`의 데이터에서는 `PlanTaskNode` (간략 정보)만 있음
- 사이드 패널에 상세 정보를 표시하려면 별도로 `/api/tasks` 데이터 필요
- `usePlanTree` 훅 내부에서 이미 tasks 전체를 fetch하므로, 훅에서 `allTasks` 도 함께 반환하도록 한다
- 선택된 Task ID로 `allTasks`에서 매칭하여 `TaskDetailPanel`에 전달

### 2. 사이드바 Plan 탭 활성화

**SPRINT-003 완료 여부에 따른 분기:**

**(A) SPRINT-003 완료 시** (사이드바가 이미 라우트 기반):
- `navItems`에서 Plan 항목의 `disabled: true` → `disabled: false` 변경
- `href: "/plan"` 추가

**(B) SPRINT-003 미완료 시** (사이드바가 아직 정적):
- `navItems` 배열에 `href` 필드 추가
- `usePathname()` 으로 현재 경로 감지 → 활성 탭 동적 결정
- `Button` → Next.js `Link` 기반으로 전환
- Plan 항목: `{ label: "Plan", icon: <FileText />, href: "/plan", disabled: false }`
- Task 항목: `{ label: "Task", icon: <ClipboardList />, href: "/", disabled: false }`

작업자는 현재 `sidebar.tsx`의 상태를 확인한 뒤 (A) 또는 (B) 방식으로 구현한다.

## 입출력

- 입력: `usePlanTree()` 훅 데이터
- 출력: `/plan` 경로에서 Plan 트리 조감도가 렌더링됨

## 완료 조건

- `/plan` 접속 시 Plan → Sprint → Task 트리 조감도가 표시됨
- Task 클릭 시 사이드 패널에 상세 정보(id, title, status, priority, role, depends_on 등)가 표시됨
- Sprint 클릭 시 워터폴 뷰(`/`)로 이동함
- 사이드바 Plan 탭 클릭 시 `/plan`으로 이동함
- 사이드바에서 현재 경로에 맞는 탭이 활성 스타일로 표시됨
- 로딩/에러 상태가 올바르게 처리됨
