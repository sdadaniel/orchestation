---
id: TASK-248
title: cost-parser.ts 불필요 export 제거 (parseCostLogLine)
status: in_progress
branch: task/task-248
worktree: ../repo-wt-task-248
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-27 06:22:17
depends_on: []
scope: []
---
TASK-248은 이미 reserved 상태입니다. 다음 ID를 사용하겠습니다.

---
id: TASK-249
title: cost-parser.ts 불필요 export 제거 (parseCostLogLine)
status: failed
branch: task/task-248
worktree: ../repo-wt-task-248
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/cost-parser.ts
---
`parseCostLogLine` 함수가 `export`로 선언되어 있으나, 외부에서 import하는 곳이 없음. 동일 파일 내 `parseCostLog()` 에서만 내부 호출됨. 불필요한 `export` 키워드를 제거하여 모듈 public API를 정리한다.

## Completion Criteria
- `parseCostLogLine` 함수에서 `export` 키워드 제거
- 기존 빌드(`npm run build`) 정상 통과 확인
