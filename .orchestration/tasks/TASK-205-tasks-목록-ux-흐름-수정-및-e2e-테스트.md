---
id: TASK-205
title: Tasks 목록 UX 흐름 수정 및 E2E 테스트
status: pending
branch: task/task-205
worktree: ../repo-wt-task-205
priority: high
scope:
  - src/frontend/src/**
  - src/frontend/tests/**
  - src/frontend/e2e/**
  - scripts/lib/**
created: 2026-03-26
updated: 2026-03-26
---
Tasks 목록 페이지의 UX 동선 전체를 검증하고 누락 동작을 수정한다.

검증 항목:
- 탭 클릭 → active 스타일 적용 + 해당 상태 필터 동작
- 빈 탭 → '해당 상태의 태스크가 없습니다' 메시지 표시
- 체인 아코디언 펼침 → 내부 카드 정상 표시
- 순서 변경 → 실제 UI에 반영

수정 완료 후 Playwright E2E 테스트 추가.

## Completion Criteria
- 탭 클릭 시 active 스타일이 적용되고 해당 상태의 태스크만 필터링됨
- 태스크가 없는 탭 선택 시 빈 상태 메시지가 표시됨
- 체인 아코디언 펼침 시 내부 태스크 카드가 정상 렌더링됨
- 순서 변경 후 목록에 즉시 반영됨
- 위 동작을 검증하는 Playwright E2E 테스트 통과
