---
id: TASK-140
title: "e2e/tasks-list.spec.ts 순환 타입 참조(TS2502) 수정"
status: done
branch: task/task-140
worktree: ../repo-wt-task-140
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/e2e/tasks-list.spec.ts
---

## 문제

`npx tsc --noEmit --strict` 실행 시 아래 타입 오류 발생:

```
e2e/tasks-list.spec.ts(9,15): error TS2502: 'page' is referenced directly or indirectly in its own type annotation.
```

**원인**: 9번째 줄의 `main` 헬퍼 함수에서 매개변수 `page`의 타입 주석이 자기 자신(`page`)을 참조하여 순환 참조가 발생한다.

```ts
// 현재 (순환 참조)
const main = (page: Parameters<typeof page.locator>[0] extends never ? never : any) =>
  page.locator(".content-container");
```

## 수정 방안

Playwright의 `Page` 타입을 import하여 명시적으로 지정한다.

```ts
import { Page } from "@playwright/test";

const main = (page: Page) => page.locator(".content-container");
```

로직 변경 없이 타입 주석만 수정하는 경미한 변경이다.

## Completion Criteria

- `npx tsc --noEmit --strict` 실행 시 `e2e/tasks-list.spec.ts` 관련 타입 오류가 0건
- 기존 E2E 테스트 동작에 영향 없음
