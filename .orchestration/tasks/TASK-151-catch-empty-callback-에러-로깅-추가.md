---
id: TASK-151
title: ".catch(() => {}) 빈 콜백에 에러 로깅 추가"
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/hooks/useSprints.ts
  - src/frontend/src/hooks/useCosts.ts
  - src/frontend/src/app/tasks/new/page.tsx
  - src/frontend/src/components/DAGCanvas.tsx
---

## 문제

Promise 체인 끝에 `.catch(() => {})` 패턴으로 에러를 완전히 무시하는 코드가 4곳 존재합니다.
이는 ESLint `no-empty-function` 규칙 위반이며, fetch 실패 시 원인 추적이 불가능합니다.

### 발견 위치

1. **useSprints.ts:103** — `.catch(() => {})` 빈 에러 핸들러
2. **useCosts.ts:72** — `.catch(() => {})` 빈 에러 핸들러
3. **tasks/new/page.tsx:138** — `.catch(() => {})` 빈 에러 핸들러
4. **DAGCanvas.tsx:238** — `.catch(() => {})` 빈 에러 핸들러

## 수정 방안

각 `.catch(() => {})` 를 `.catch(() => { /* 의도적 무시: (사유) */ })` 형태의 주석 추가,
또는 `console.warn`으로 최소한의 로깅 추가. 로직 변경 없이 에러 가시성만 확보합니다.

## Completion Criteria

- [ ] 4개 파일의 `.catch(() => {})` 패턴이 모두 주석 또는 최소 로깅으로 교체됨
- [ ] 기존 동작(에러 시 조용히 무시)은 유지 — 사용자 경험 변경 없음
- [ ] TypeScript 빌드 에러 없음
