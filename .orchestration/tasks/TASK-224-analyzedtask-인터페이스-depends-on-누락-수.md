---
id: TASK-224
title: AnalyzedTask-인터페이스-depends_on-누락-수정
status: failed
branch: task/task-224
worktree: ../repo-wt-task-224
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/analyze/route.ts
---
`route.ts:154-160`의 fallback 응답 객체에 `AnalyzedTask` 인터페이스의 필수 속성 `depends_on: number[]`가 누락되어 있음. strict 모드에서 타입 불일치 발생.

```typescript
// AS-IS (line 154-160)
{
  title: title.trim(),
  description: description.trim() || title.trim(),
  priority: "medium",
  criteria: ["Complete the requested work"],
  scope: [],
}

// TO-BE
{
  title: title.trim(),
  description: description.trim() || title.trim(),
  priority: "medium",
  criteria: ["Complete the requested work"],
  scope: [],
  depends_on: [],
}
```

## Completion Criteria
- fallback 객체에 `depends_on: []` 추가
- `tsc --noEmit` 타입 체크 통과 확인
