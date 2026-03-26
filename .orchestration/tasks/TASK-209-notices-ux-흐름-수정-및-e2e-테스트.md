---
id: TASK-209
title: Notices UX 흐름 수정 및 E2E 테스트
status: in_progress
branch: task/task-209
worktree: ../repo-wt-task-209
priority: high
scope:
  - src/frontend/src/**
  - src/frontend/tests/**
  - src/frontend/e2e/**
  - scripts/lib/**
created: 2026-03-26
updated: 2026-03-26
---
Notices 관련 UX 동선 전체를 검증하고 누락 동작을 수정한다.

검증 항목:
- 사이드바 Notice 클릭 → /notices 이동 → 해당 Notice read: true 처리
- /notices에서 안 읽은 Notice 시각 구분 (배경색/볼드 등)
- Notice 읽으면 사이드바 뱃지 숫자 감소
- 전체 읽음 처리 버튼 동작

수정 완료 후 Playwright E2E 테스트 추가.

## Completion Criteria
- 사이드바 Notice 클릭 시 /notices로 이동하고 해당 항목이 read: true 처리됨
- 미읽음 Notice가 배경색 또는 볼드로 시각 구분됨
- Notice 읽음 처리 시 사이드바 뱃지 숫자가 즉시 감소함
- 전체 읽음 버튼 클릭 시 모든 Notice가 읽음 처리되고 뱃지가 0이 됨
- 위 동작을 검증하는 Playwright E2E 테스트 통과
