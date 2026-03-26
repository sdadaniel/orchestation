---
id: TASK-161
title: Prettier 포맷 위반 107개 파일 일괄 수정
status: in_progress
branch: task/task-161
worktree: ../repo-wt-task-161
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/**/*.ts
  - src/frontend/src/**/*.tsx
---

## 문제

`npx prettier --check 'src/**/*.{ts,tsx}'` 실행 결과, **107개 파일**에서 Prettier 코드 스타일 위반이 발견됨.

주요 위반 영역:
- `src/hooks/` — 대부분의 커스텀 훅 파일
- `src/lib/` — 파서, 매니저, 유틸 등 거의 전체
- `src/components/` — DAGCanvas 등 200자 이상 초장문 라인 다수
- `src/app/` — 페이지 및 API 라우트 파일
- `src/store/` — 상태 관리 파일

## 작업 내용

1. `npx prettier --write 'src/**/*.{ts,tsx}'` 실행하여 전체 파일 자동 포맷팅
2. 포맷팅 후 `npx prettier --check` 재실행하여 위반 0건 확인
3. TypeScript 컴파일 에러 없는지 `npx tsc --noEmit` 확인 (기존 에러 제외)
4. 개발 서버 정상 구동 확인

## Completion Criteria

- `npx prettier --check 'src/**/*.{ts,tsx}'` 실행 시 위반 0건
- 로직 변경 없이 순수 포맷팅만 적용됨
- 빌드/타입체크 기존 상태 유지
