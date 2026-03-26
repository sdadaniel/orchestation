---
id: TASK-174
title: "throw new Error() 빈 메시지에 에러 문구 추가"
status: in_progress
branch: task/task-174
worktree: ../repo-wt-task-174
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/hooks/useRequests.ts
  - src/frontend/src/components/RequestCard.tsx
  - src/frontend/src/app/tasks/[id]/page.tsx
---

## 문제

`throw new Error()` 호출 시 메시지 인자 없이 빈 Error를 던지는 코드가 4곳 존재합니다.
이는 디버깅 시 에러 원인 추적을 어렵게 만들며, ESLint `unicorn/error-message` 규칙 위반에 해당합니다.

### 발견 위치

1. **useRequests.ts:160** — `if (!res.ok) throw new Error();`
2. **RequestCard.tsx:50** — `.then((r) => { if (!r.ok) throw new Error(); return r.json(); })`
3. **RequestCard.tsx:58** — `.then((r) => { if (!r.ok) throw new Error(); return r.json(); })`
4. **tasks/[id]/page.tsx:199** — `.then((r) => { if (!r.ok) throw new Error(); return r.json(); })`

## 수정 방안

각 `throw new Error()`에 HTTP 상태 코드 또는 맥락을 포함한 메시지를 추가합니다.
예: `throw new Error(\`HTTP \${r.status}\`)` 또는 `throw new Error("fetch failed")`

로직 변경 없이 에러 메시지만 추가하는 경미한 수정입니다.

## Completion Criteria

- [ ] 4곳의 `throw new Error()`에 의미 있는 에러 메시지가 추가됨
- [ ] 기존 동작(에러 throw → catch에서 처리) 변경 없음
- [ ] TypeScript 빌드 에러 없음
