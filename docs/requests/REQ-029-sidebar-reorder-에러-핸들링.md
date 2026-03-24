---
id: REQ-029
title: Sidebar reorder 에러 핸들링
status: done
priority: medium
created: 2026-03-24
---
사이드바 drag-and-drop reorder에서 parentId: null, index: -1 전달 시 API 실패해도 사용자 피드백 없음.

## 문제
- `components/sidebar.tsx:241-246`
- onReorder 호출 시 에러 catch 없음
- 실패 시 UI와 서버 상태 불일치

## Completion Criteria
- try-catch로 reorder 실패 시 토스트 에러 메시지 표시
- 실패 시 UI 상태 롤백 또는 리페치
