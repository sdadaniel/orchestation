---
id: TASK-185
title: UX 흐름 검증 — 사용자 동선별 누락 동작 수정
status: in_progress
branch: task/task-185
worktree: ../repo-wt-task-185
priority: high
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/notices/page.tsx
  - src/frontend/src/components/sidebar.tsx
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/tasks/page.tsx
  - src/frontend/src/components/RequestCard.tsx
  - src/frontend/e2e/**
---

## 목표
각 페이지의 사용자 동선을 따라가며 빠진 동작을 찾아 수정한다.
코드 자체가 아니라 "유저가 클릭했을 때 기대하는 동작"이 실제로 일어나는지 검증.

## 검증할 동선

### Notices
- [ ] 사이드바 Notice 클릭 → /notices 이동 → 해당 Notice read: true 처리
- [ ] /notices에서 안 읽은 Notice 시각 구분 (배경색/볼드 등)
- [ ] Notice 읽으면 사이드바 뱃지 숫자 감소
- [ ] 전체 읽음 처리 버튼

### Tasks 목록
- [ ] 탭 클릭 → active 스타일 + 해당 상태 필터
- [ ] 빈 탭 → "해당 상태의 태스크가 없습니다" 표시
- [ ] 체인 아코디언 펼침 → 내부 카드 정상 표시
- [ ] 순서 변경 → 실제 반영

### Task 상세
- [ ] 상태 드롭다운 변경 → UI 즉시 반영 + 목록에도 반영
- [ ] 실행 버튼 → 로그 탭 전환 + 실시간 로그
- [ ] done 상태 → 실행 버튼 비활성화

### Night Worker
- [ ] 시작 → 로그 탭 전환 + 실시간 로그
- [ ] 중지 → 상태 변경
- [ ] 완료 → Notice 생성 확인

## 수정 방법
각 동선에서 빠진 동작을 코드로 수정하고, Playwright E2E 테스트를 추가.

## Completion Criteria
- 위 체크리스트 전부 통과
- 누락 동작 수정 완료
- E2E 테스트 추가
