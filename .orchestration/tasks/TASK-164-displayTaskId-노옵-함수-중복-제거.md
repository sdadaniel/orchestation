---
id: TASK-164
title: displayTaskId 노옵 함수 중복 제거
status: in_progress
branch: task/task-164
worktree: ../repo-wt-task-164
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/components/sidebar.tsx
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/requests/page.tsx
---

`displayTaskId` 함수가 4개 파일에 중복 정의되어 있다.

- `AppShell.tsx:33` — `(id: string) => id` (identity, 노옵)
- `sidebar.tsx:466` — `(id: string) => id` (identity, 노옵)
- `tasks/[id]/page.tsx:65` — `(id: string) => id` (identity, 노옵)
- `requests/page.tsx:33` — `(id: string) => id.replace(/^REQ-/, "TASK-")` (실제 변환)

3곳의 identity 함수는 아무 변환도 하지 않으므로 불필요한 추상화다. REQ→TASK 전환이 완료된 후 남은 잔재물로 보인다.

### 수정 방안

1. `AppShell.tsx`, `sidebar.tsx`, `tasks/[id]/page.tsx`에서 `displayTaskId` 함수 정의를 제거하고, 호출부를 `task.id`로 직접 대체
2. `requests/page.tsx`의 `displayTaskId`는 실제 변환이 있으므로 유지 (또는 REQ 개념이 완전히 제거되었다면 함께 제거)

### 변경 규모

- 로직 변경 없음 — identity 함수 호출을 인라인으로 대체할 뿐
- 파일 3~4개, 각 파일에서 함수 정의 1줄 + 호출부 1~3줄 수정

## Completion Criteria

- [ ] `AppShell.tsx`, `sidebar.tsx`, `tasks/[id]/page.tsx`에서 `displayTaskId` identity 함수 제거
- [ ] 해당 호출부가 `task.id` 직접 참조로 대체됨
- [ ] `requests/page.tsx`의 `displayTaskId`는 REQ 개념 사용 여부에 따라 유지 또는 제거
- [ ] 빌드 에러 없음
