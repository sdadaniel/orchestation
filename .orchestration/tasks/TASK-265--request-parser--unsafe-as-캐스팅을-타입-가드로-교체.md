---
id: TASK-265
title: "request-parser: unsafe as 캐스팅을 타입 가드로 교체"
status: done
branch: task/task-265
worktree: ../repo-wt-task-265
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:  []
---

The unsafe `as` casts in `request-parser.ts` are the clearest strict-mode type safety issue — arbitrary strings from frontmatter are cast to union types without validation.

---
id: TASK-265
title: "request-parser: unsafe as 캐스팅을 타입 가드로 교체"
status: done
branch: task/task-265
worktree: ../repo-wt-task-265
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/lib/request-parser.ts
  - src/frontend/src/lib/notice-parser.ts
---
`request-parser.ts` 30-31행과 `notice-parser.ts` 31행에서 `getString()` 반환값을 `as RequestData["status"]`, `as RequestData["priority"]`, `as NoticeType`으로 무검증 캐스팅하고 있다. frontmatter에 오타나 잘못된 값이 들어오면 런타임에 유효하지 않은 유니언 타입 값이 그대로 통과한다.

허용 값 배열(`VALID_STATUSES`, `VALID_PRIORITIES`, `VALID_NOTICE_TYPES`)을 정의하고 `includes()` 타입 가드로 검증 후 캐스팅하거나, 불일치 시 기본값을 반환하도록 수정한다. `parser.ts`의 기존 패턴을 참고.

## Completion Criteria
- `getString()` 결과를 `as`로 직접 캐스팅하는 코드가 0건
- 허용 값 배열 + `includes()` 가드 후 캐스팅 또는 기본값 폴백 적용
- `npx tsc --noEmit` 통과

## Completion Criteria


