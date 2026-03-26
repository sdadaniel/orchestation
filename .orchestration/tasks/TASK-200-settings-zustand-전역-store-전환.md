---
id: TASK-200
title: Settings zustand 전역 store 전환
status: in_progress
branch: task/task-200
worktree: ../repo-wt-task-200
priority: medium
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/store/settingsStore.ts
  - src/frontend/src/app/settings/page.tsx
  - src/frontend/src/components/AutoImproveControl.tsx
---

## 현상
- Settings가 페이지 내 useState로만 관리
- 다른 컴포넌트에서 settings 값 필요 시 매번 /api/settings fetch
- settingsStore가 없음

## 수정 방향
- settingsStore.ts 생성 (zustand)
- 앱 시작 시 settings fetch → store에 저장
- Settings 페이지에서 store 구독 + save 시 store 업데이트
- AutoImproveControl, Night Worker 등에서 store 직접 구독 (maxParallel, model 등)

## Completion Criteria
- settingsStore 생성 + 앱 시작 시 초기 로드
- Settings 페이지 store 기반으로 전환
- 다른 컴포넌트에서 store 직접 구독 가능
