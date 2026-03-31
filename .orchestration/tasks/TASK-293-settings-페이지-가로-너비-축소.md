---
id: TASK-293
title: Settings 페이지 가로 너비 축소
status: done
branch: task/task-293
worktree: ../repo-wt-task-293
priority: medium
created: 2026-03-31
updated: 2026-03-31 09:47
depends_on: []
scope:
  - src/frontend/src/app/settings/page.tsx
---

## 목표

Settings 페이지의 콘텐츠 영역 가로 너비를 축소하여 가독성 개선.
현재 전체 너비를 차지하여 입력 필드가 불필요하게 넓음.

CLAUDE.md 디자인 규칙: "모든 페이지: `<PageLayout>` + `<PageHeader>` 사용 (max-w-3xl, space-y-4, pb-16)"

## 작업 내용

- `settings/page.tsx`에서 `<PageLayout>`에 `max-w-2xl` 클래스 추가 (settings는 폼이 단순하므로 3xl보다 좁은 2xl 적용)
- 좌우 여백을 위해 `mx-auto` 추가

## 완료 조건

- [ ] Settings 페이지 콘텐츠 영역이 max-w-2xl로 제한됨
- [ ] 입력 필드, 슬라이더 등이 적절한 너비로 표시됨
- [ ] 모바일/데스크톱 반응형 유지
