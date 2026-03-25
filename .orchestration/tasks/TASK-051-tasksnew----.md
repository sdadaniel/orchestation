---
id: TASK-051
title: /tasks/new 페이지 콘텐츠 중앙 정렬
status: done
priority: low
sprint:
depends_on: []
branch: task/TASK-051-tasksnew----
worktree: ../repo-wt-TASK-051
role: general
reviewer_role: reviewer-general
---

# TASK-051: /tasks/new 페이지 콘텐츠 중앙 정렬

## 원본 요청

- Request: REQ-017
- 제목: /tasks/new 페이지 콘텐츠 중앙 정렬
- 내용: 현재 `max-w-2xl`만 적용되어 좌측 정렬된 레이아웃을 중앙 정렬로 수정. `src/frontend/src/app/tasks/new/page.tsx`의 최상위 div에 `mx-auto` 클래스를 추가한다.

## Completion Criteria
- 최상위 div에 mx-auto가 추가되어 콘텐츠가 페이지 중앙에 배치됨
- 기존 max-w-2xl 너비 제한은 유지됨
- input 단계와 preview 단계 모두 중앙 정렬 적용됨

## 완료 조건

- `src/frontend/src/app/tasks/new/page.tsx` 최상위 div에 `mx-auto` 클래스 추가
- 기존 `max-w-2xl` 유지
- input/preview 단계 모두 중앙 정렬 확인
