---
id: TASK-039
title: Request 메뉴에 reviewing 상태 추가 및 in_progress 스피너 표시
status: backlog
priority: medium
sprint:
depends_on: []
branch: task/TASK-039-request--reviewing----inprogre
worktree: ../repo-wt-TASK-039
role: general
reviewer_role: reviewer-general
---

# TASK-039: Request 메뉴에 reviewing 상태 추가 및 in_progress 스피너 표시

## 원본 요청

- Request: REQ-006
- 제목: reqeust 메뉴
- 내용: 여기서 너가 검토를 하다가 거절할 수도 잇단말이지. 진행중일때는 in progress가 맞는데 검토중일 때는 다른 상태로 표시해줘.
그리고 진행중일 때는 뱅글뱅글하게 확실하게 돌아가고 있는거 보여줘.

## 완료 조건

- `useRequests.ts`의 `RequestItem` 타입에 `"reviewing"` 상태 추가
- `requests/page.tsx`의 `STATUS_DOT`, `STATUS_LABEL`, `STATUS_ORDER`에 `reviewing` 항목 추가 (예: 주황색 dot, "Reviewing" 라벨)
- `request-parser.ts`에서 `reviewing` 상태값 파싱 지원
- `requests/page.tsx` 요청 카드에서 `in_progress` 상태일 때 정적 dot 대신 `animate-spin` 스피너 표시 (AppShell의 태스크 사이드바와 동일한 방식)
- `reviewing` 상태는 스피너 없이 주황색 정적 dot으로 구분
