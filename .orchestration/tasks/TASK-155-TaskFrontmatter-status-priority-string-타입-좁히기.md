---
id: TASK-155
title: "TaskFrontmatter status·priority를 string에서 union 타입으로 좁히기"
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/lib/parser.ts
  - src/frontend/src/components/TaskRow.tsx
  - src/frontend/src/components/TaskEditSheet.tsx
  - src/frontend/src/components/BatchEditor.tsx
  - src/frontend/src/components/RightPanel.tsx
  - src/frontend/src/components/plan/PlanTreeContainer.tsx
  - src/frontend/src/components/waterfall/TaskBar.tsx
  - src/frontend/src/components/waterfall/TaskDetailPanel.tsx
  - src/frontend/src/app/sprint/page.tsx
  - src/frontend/src/app/sprint/[id]/page.tsx
---

## 문제

`TaskFrontmatter` (`lib/parser.ts:5-15`)의 `status`와 `priority` 필드가 `string`으로 선언되어 있다.
실제로는 `TaskStatus` / `TaskPriority` union 타입만 들어오지만, 타입이 넓어 9개 컴포넌트에서 `as TaskStatus` / `as TaskPriority` 타입 단언(type assertion)을 반복하고 있다.

### 현황 (18건, 9개 파일)

| 파일 | `as TaskStatus` | `as TaskPriority` |
|------|:-:|:-:|
| `TaskRow.tsx` | 1 | 1 |
| `TaskEditSheet.tsx` | 2 | 1 |
| `BatchEditor.tsx` | 1 | 2 |
| `RightPanel.tsx` | 2 | 2 |
| `sprint/page.tsx` | 2 | 2 |
| `sprint/[id]/page.tsx` | 2 | 1 |
| `plan/PlanTreeContainer.tsx` | ○ | ○ |
| `waterfall/TaskBar.tsx` | ○ | ○ |
| `waterfall/TaskDetailPanel.tsx` | ○ | ○ |

### 수정 방법

1. `lib/parser.ts`에서 `TaskFrontmatter` 인터페이스의 필드 타입 변경:
   - `status: string` → `status: TaskStatus` (`lib/constants.ts`에서 import)
   - `priority: string` → `priority: TaskPriority` (`lib/constants.ts`에서 import)
2. 파서(`parseTaskFile`)에서 YAML frontmatter 파싱 시 유효하지 않은 값에 대한 기본값 처리 추가 (예: `status`가 유효하지 않으면 `"pending"`, `priority`가 유효하지 않으면 `"medium"`)
3. 9개 파일에서 불필요해진 `as TaskStatus` / `as TaskPriority` 타입 단언 제거

### 주의

- 로직 변경 없음 — 타입 어노테이션과 불필요한 타입 단언만 제거
- `PlanTaskNode` (`types/plan.ts`)과 `DependsOnSelector.TaskOption`도 `status: string`이지만, 이들은 `TaskFrontmatter`와 별도 타입이므로 이 태스크 범위 밖
- TASK-154(상수 중복 통합)와 독립적으로 수행 가능하나, TASK-154 이후 적용하면 import 경로가 더 깔끔해질 수 있음

## Completion Criteria

- `TaskFrontmatter.status`가 `TaskStatus` 타입으로 선언됨
- `TaskFrontmatter.priority`가 `TaskPriority` 타입으로 선언됨
- 파서에서 유효하지 않은 status/priority 값에 대한 기본값 방어 코드 존재
- 9개 파일에서 `as TaskStatus` / `as TaskPriority` 단언이 제거됨
- `npx tsc --noEmit` 통과
- 기존 동작 변경 없음
