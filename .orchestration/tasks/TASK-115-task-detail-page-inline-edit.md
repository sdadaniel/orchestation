---
id: TASK-115
title: Task 상세 페이지에 인라인 편집 기능 추가
status: failed
priority: low
sprint:
depends_on: []
branch: task/TASK-115-task-detail-page-inline-edit
worktree: ../repo-wt-TASK-115
role: frontend-dev
reviewer_role: reviewer-general
scope:
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/api/requests/[id]/route.ts
---

# TASK-115: Task 상세 페이지에 인라인 편집 기능 추가

## 목표

/tasks/[id] 상세 페이지에서 제목, 내용, 우선순위를 직접 수정할 수 있는 편집 기능 추가.
현재는 목록 페이지 카드 펼침에서만 편집 가능하고, 상세 페이지에는 수정 버튼이 없음.

## 완료 조건

- [ ] 상세 페이지 Description 섹션에 Edit 버튼 추가
- [ ] 클릭 시 제목, 내용, 우선순위를 인라인 편집 가능
- [ ] Save/Cancel 버튼으로 저장/취소
- [ ] PUT /api/requests/[id] API를 통해 저장
- [ ] done 상태인 태스크는 편집 불가 (읽기 전용)

## 실패 사유 (2026-03-24 17:57)

Not logged in · Please run /login

## 실패 사유 (2026-03-24 18:34)

Not logged in · Please run /login

## 실패 사유 (2026-03-24 18:36)

Not logged in · Please run /login
