---
id: TASK-077
title: Sidebar reorder 에러 핸들링 추가
status: in_progress
priority: medium
sprint:
depends_on: []
branch: task/TASK-077-sidebar-reorder---
worktree: ../repo-wt-TASK-077
role: general
reviewer_role: reviewer-general
---

# TASK-077: Sidebar reorder 에러 핸들링 추가

## 원본 요청

- Request: REQ-029
- 제목: Sidebar reorder 에러 핸들링
- 내용: 사이드바 drag-and-drop reorder에서 parentId: null, index: -1 전달 시 API 실패해도 사용자 피드백 없음.

## 문제
- `components/sidebar.tsx:241-246`
- onReorder 호출 시 에러 catch 없음
- 실패 시 UI와 서버 상태 불일치

## Completion Criteria
- try-catch로 reorder 실패 시 토스트 에러 메시지 표시
- 실패 시 UI 상태 롤백 또는 리페치

## 완료 조건

- `components/sidebar.tsx` onReorder 호출부에 try-catch 추가
- 실패 시 토스트 에러 메시지 표시
- 실패 시 UI 상태 롤백 또는 리페치로 서버-클라이언트 상태 일치 보장
