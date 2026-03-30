---
id: TASK-277
title: raw HTML 폼 요소를 UI 컴포넌트로 교체
status: in_progress
branch: task/task-277
worktree: ../repo-wt-task-277
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:  []
---

3개 파일에서 raw HTML 요소(`<select>`, `<textarea>`, `<input>`) 사용을 확인했습니다. CLAUDE.md 디자인 시스템 규칙 위반입니다.

---
id: TASK-277
title: raw HTML 폼 요소를 UI 컴포넌트로 교체
status: in_progress
branch: task/task-277
worktree: ../repo-wt-task-277
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/app/tasks/[id]/TaskMetadata.tsx
  - src/frontend/src/components/ChatBot.tsx
  - src/frontend/src/components/GlobalSearch.tsx
---
CLAUDE.md 디자인 시스템 규칙에서 `<input>`, `<select>`, `<textarea>` 직접 사용을 금지하고 `@/components/ui/` 컴포넌트 사용을 요구하지만, 3개 파일에서 raw HTML 폼 요소가 사용되고 있다.

- `TaskMetadata.tsx:38` — `<select>` → `Select` 컴포넌트로 교체
- `ChatBot.tsx:368` — `<textarea>` → `Textarea` 컴포넌트로 교체
- `GlobalSearch.tsx:191` — `<input>` → `Input` 컴포넌트로 교체

로직 변경 없이 컴포넌트만 교체하며, 기존 스타일링과 동작을 유지한다.

## Completion Criteria
- 위 3개 파일에서 raw HTML 폼 요소(`<select>`, `<textarea>`, `<input>`)가 `@/components/ui/` 컴포넌트로 교체됨
- 기존 onChange, onKeyDown 등 이벤트 핸들러 동작 유지
- `npm run build` 에러 없음

## Completion Criteria


