---
id: TASK-292
title: parser 유틸 as-any 캐스트를 타입 안전 includes 헬퍼로 교체
status: in_progress
branch: task/task-292
worktree: ../repo-wt-task-292
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - src/frontend/src/lib/notice-parser.ts
  - src/frontend/src/lib/request-parser.ts
---
`notice-parser.ts`와 `request-parser.ts`에서 `VALID_*.includes(value as any)` 패턴이 총 3회 사용되고 있다. `as any`는 TypeScript 타입 검사를 우회하므로 코드 스타일 위반이다.

`as const` 배열의 요소 타입을 활용한 타입 안전 헬퍼로 교체한다:
```typescript
// before
return VALID_NOTICE_TYPES.includes(value as any);

// after
return (VALID_NOTICE_TYPES as readonly string[]).includes(value);
```

## Completion Criteria
- `notice-parser.ts:21`의 `as any` 제거
- `request-parser.ts:24`의 `as any` 제거
- `request-parser.ts:28`의 `as any` 제거
- 프로젝트 빌드(`next build`) 성공 확인
- 기존 로직 변경 없음
