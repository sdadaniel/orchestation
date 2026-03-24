---
id: REQ-025
title: useDocDetail fetch 순서 보장
status: done
priority: high
created: 2026-03-24
---
useDocDetail 훅에서 ID가 빠르게 변경될 때 이전 fetch 응답이 나중에 도착하면 잘못된 문서가 표시됨.

## 문제
- `hooks/useDocTree.ts:106-131`
- AbortController 미사용으로 이전 요청 취소 불가
- ID A → ID B 전환 시, A 응답이 B 이후 도착하면 A 내용이 표시됨

## Completion Criteria
- AbortController로 이전 fetch 취소 구현
- ID 변경 시 항상 최신 ID의 응답만 반영
