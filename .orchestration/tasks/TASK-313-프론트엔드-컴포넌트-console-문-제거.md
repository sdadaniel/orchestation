---
id: TASK-313
title: 프론트엔드-컴포넌트-console-문-제거
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:  []
---

`console.log`은 서버사이드 유틸에서는 허용될 수 있지만, 프론트엔드 컴포넌트의 `console.error`는 불필요합니다. 여러 파일에 걸쳐 `console.*` 문이 산재해 있으므로 이를 정리하는 태스크를 만들겠습니다.

---
id: TASK-313
title: 프론트엔드-컴포넌트-console-문-제거
status: pending
priority: medium
mode: night
created: 2026-04-02
updated: 2026-04-02
depends_on: []
scope:
  - src/frontend/src/components/DAGCanvas.tsx
  - src/frontend/src/components/sidebar/DocTreeNode.tsx
  - src/frontend/src/app/tasks/new/page.tsx
  - src/frontend/src/app/tasks/[id]/page.tsx
---
프론트엔드 클라이언트 컴포넌트에 남아 있는 `console.error` / `console.warn` 호출을 제거한다.

- `DAGCanvas.tsx:237` — catch 블록의 `console.error` 제거 (빈 catch 또는 무시)
- `DocTreeNode.tsx:118` — catch 블록의 `console.error` 제거
- `tasks/new/page.tsx:45` — catch 블록의 `console.error` 제거
- `tasks/[id]/page.tsx:97,110,155,159` — 4건의 `console.error`/`console.warn` 제거

서버사이드 API route(`api/chat`, `api/tasks/suggest`, `api/tasks/analyze`)와 서버 유틸(`task-runner-utils.ts`)의 console 문은 서버 로깅 용도이므로 대상에서 제외한다.

## Completion Criteria
- 위 4개 파일에서 `console.error` / `console.warn` / `console.log` 호출이 모두 제거됨
- `npx next build` 또는 `npx tsc --noEmit`이 에러 없이 통과
- 로직 변경 없이 console 문만 제거

## Completion Criteria


