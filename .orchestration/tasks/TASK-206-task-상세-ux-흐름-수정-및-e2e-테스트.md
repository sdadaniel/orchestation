---
id: TASK-206
title: Task 상세 UX 흐름 수정 및 E2E 테스트
status: in_progress
branch: task/task-206
worktree: ../repo-wt-task-206
priority: high
scope:
  - src/frontend/src/**
  - src/frontend/tests/**
  - src/frontend/e2e/**
  - scripts/lib/**
created: 2026-03-26
updated: 2026-03-26
---
Task 상세 페이지의 UX 동선 전체를 검증하고 누락 동작을 수정한다.

검증 항목:
- 상태 드롭다운 변경 → UI 즉시 반영 + 목록에도 반영
- 실행 버튼 → 로그 탭 전환 + 실시간 로그 표시
- done 상태 → 실행 버튼 비활성화

수정 완료 후 Playwright E2E 테스트 추가.

## Completion Criteria
- 상태 드롭다운 변경 시 상세 페이지 UI가 즉시 반영되고 목록에도 동기화됨
- 실행 버튼 클릭 시 로그 탭으로 전환되고 실시간 로그가 스트리밍됨
- done 상태인 태스크의 실행 버튼이 비활성화(disabled)됨
- 위 동작을 검증하는 Playwright E2E 테스트 통과
