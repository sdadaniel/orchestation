---
id: TASK-071
title: useRequests unmount 후 setState 방지
status: pending
priority: medium
sprint:
depends_on: []
branch: task/TASK-071-userequests-unmount--setstate-
worktree: ../repo-wt-TASK-071
role: general
reviewer_role: reviewer-general
---

# TASK-071: useRequests unmount 후 setState 방지

## 원본 요청

- Request: REQ-028
- 제목: useRequests unmount setState 방지
- 내용: useRequests 훅에서 컴포넌트 unmount 후 fetch가 완료되면 setState on unmounted component 경고 발생.

## 문제
- `hooks/useRequests.ts`
- fetchRequests 내 setState 호출 시 컴포넌트가 이미 unmount된 상태일 수 있음

## Completion Criteria
- AbortController 또는 cancelled 플래그로 unmount 후 setState 방지
- React strict mode에서도 경고 없음

## 완료 조건

- `hooks/useRequests.ts`의 fetchRequests 함수에 AbortController 또는 isCancelled 플래그 적용
- useEffect cleanup에서 abort/flag 처리하여 unmount 후 setState 호출 차단
- React strict mode(double-invoke) 환경에서 경고 미발생 확인
