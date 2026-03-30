---
id: TASK-285
title: context-builder.sh local 선언에 잘못 배치된 에러 핸들링 정리
status: done
branch: task/task-285
worktree: ../repo-wt-task-285
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - scripts/lib/context-builder.sh
---
`scripts/lib/context-builder.sh` 22행에서 `local st 2>/dev/null || true` 구문이 있다.
`local` 빌트인 선언에 `2>/dev/null || true`를 붙이는 것은 무의미하며, 실제 에러가 발생할 수 있는 `get_field` 호출(23행)에 적용되어야 할 에러 핸들링이 잘못된 위치에 있다.

**현재 코드 (22-23행):**
```bash
local st 2>/dev/null || true
st=$(get_field "$f" "status")
```

**수정안:**
```bash
local st
st=$(get_field "$f" "status")
```

## Completion Criteria
- `local st 2>/dev/null || true`에서 불필요한 `2>/dev/null || true` 제거
- `bash -n scripts/lib/context-builder.sh` 문법 검증 통과
