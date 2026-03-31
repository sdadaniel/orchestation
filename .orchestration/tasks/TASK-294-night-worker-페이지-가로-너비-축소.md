---
id: TASK-294
title: Night Worker 페이지 가로 너비 축소
status: done
branch: task/task-294
worktree: ../repo-wt-task-294
priority: medium
created: 2026-03-31
updated: 2026-03-31 10:43
depends_on: []
scope:
  - src/frontend/src/app/night-worker/page.tsx
---

## 목표

Night Worker 페이지의 콘텐츠 영역 가로 너비를 축소하여 가독성 개선.
Settings 페이지와 동일한 방식으로 `<PageLayout>`에 `max-w-2xl mx-auto` 적용.

## 참고

TASK-293에서 Settings 페이지에 동일한 작업 완료. 커밋 참고: `9470c3b`

## 작업 내용

- `night-worker/page.tsx`의 `<PageLayout>`에 `className="max-w-2xl mx-auto"` 추가

## 완료 조건

- [ ] Night Worker 페이지 콘텐츠 영역이 max-w-2xl로 제한됨
- [ ] 기존 기능(스캔 타입 선택, 시간/예산 설정, Start/Stop 등) 정상 동작
