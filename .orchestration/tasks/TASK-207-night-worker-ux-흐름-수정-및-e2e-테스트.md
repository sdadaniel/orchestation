---
id: TASK-207
title: Night Worker UX 흐름 수정 및 E2E 테스트
status: failed
branch: task/task-207
worktree: ../repo-wt-task-207
priority: medium
scope:
  - src/frontend/src/**
  - src/frontend/tests/**
  - src/frontend/e2e/**
  - scripts/lib/**
created: 2026-03-26
updated: 2026-03-26
---
Night Worker 페이지의 UX 동선 전체를 검증하고 누락 동작을 수정한다.

검증 항목:
- 시작 → 로그 탭 전환 + 실시간 로그 표시
- 중지 → 상태 변경 반영
- 완료 → Notice 생성 확인

수정 완료 후 Playwright E2E 테스트 추가.

## Completion Criteria
- Night Worker 시작 시 로그 탭으로 전환되고 실시간 로그가 표시됨
- Night Worker 중지 시 상태가 즉시 변경되어 UI에 반영됨
- Night Worker 완료 시 관련 Notice가 생성됨
- 위 동작을 검증하는 Playwright E2E 테스트 통과
