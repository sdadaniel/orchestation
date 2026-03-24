---
id: REQ-028
title: useRequests unmount setState 방지
status: done
priority: medium
created: 2026-03-24
---
useRequests 훅에서 컴포넌트 unmount 후 fetch가 완료되면 setState on unmounted component 경고 발생.

## 문제
- `hooks/useRequests.ts`
- fetchRequests 내 setState 호출 시 컴포넌트가 이미 unmount된 상태일 수 있음

## Completion Criteria
- AbortController 또는 cancelled 플래그로 unmount 후 setState 방지
- React strict mode에서도 경고 없음
