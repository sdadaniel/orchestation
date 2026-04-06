---
id: TASK-354
title: orchestrate-engine-TaskInfo-생성-로직-중복-제거
status: done
branch: task/task-354
worktree: ../repo-wt-task-354
priority: medium
mode: night
created: 2026-04-06 11:20
updated: 2026-04-06 11:46
depends_on: []
scope:
  - src/frontend/src/lib/orchestrate-engine.ts
---

orchestrate-engine.ts의 scanTasks(184-214)와 readTaskInfo(231-253) 함수에서 TaskInfo 생성 로직이 중복되어 있습니다.

두 함수 모두 동일한 구조로 다음 필드들을 처리합니다:
- id, filePath, status, priority, branch, worktree, role, reviewerRole, scope, dependsOn, sortOrder, title

현재 코드는 이 객체 생성 부분이 거의 완전히 복제되어 있어서:
1. 유지보수 시 한쪽만 수정될 위험
2. 코드 가독성 저하
3. CLAUDE.md의 "같은 구조가 3회 이상 반복되면 반드시 컴포넌트로 추출" 규칙 위반

## Completion Criteria

- `buildTaskInfo()` 헬퍼 함수 추출 (data, taskId, filePath, status 파라미터)
- scanTasks와 readTaskInfo에서 새 헬퍼 사용하도록 수정
- 로직 변경 없음 (동작 동일)