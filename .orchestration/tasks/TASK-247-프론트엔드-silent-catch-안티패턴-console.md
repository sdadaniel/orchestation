---
id: TASK-247
title: 프론트엔드 silent catch 안티패턴 console.error 추가
status: done
branch: task/task-247
worktree: ../repo-wt-task-247
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-27 06:22:12
depends_on: []
scope:
  - src/frontend/src/components/RequestCard.tsx
  - src/frontend/src/components/DAGCanvas.tsx
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/tasks/new/page.tsx
---
프론트엔드 4개 파일에서 `.catch(() => {})` 또는 `.catch(() => setX(""))` 형태로 에러를 완전히 삼키는 안티패턴 발견 (총 7건).

에러 로깅 없이 조용히 무시하면 API 장애 시 디버깅이 불가능하고, 사용자에게 빈 화면만 노출됨.

**수정 방침:** 각 catch 블록에 `console.error` 호출을 추가하여 최소한의 에러 가시성 확보. 기존 fallback 로직(빈 문자열 세팅 등)은 유지.

**해당 위치:**
- `RequestCard.tsx:52` — fetch result catch, 에러 삼킴
- `RequestCard.tsx:69` — 빈 catch 블록
- `DAGCanvas.tsx:237` — settings fetch 빈 catch
- `tasks/[id]/page.tsx:117, 234, 314` — 3건의 silent catch
- `tasks/new/page.tsx:139` — task 목록 fetch 빈 catch

## Completion Criteria
- 7건의 silent catch에 `console.error(err)` 추가
- 기존 fallback 동작(setAiResult("") 등) 변경 없음
- TypeScript 컴파일 에러 없음
