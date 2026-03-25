---
id: TASK-133
title: Zustand 설치 및 devtools 세팅
status: done
branch: task/task-133
worktree: ../repo-wt-task-133
priority: medium
scope:
  - src/frontend/**
  - src/frontend/src/store/**
created: 2026-03-25
updated: 2026-03-25 06:42:35
---
프론트엔드에 zustand와 디버깅용 devtools를 설치하고, TypeScript 환경에서 사용 가능한 스토어 기반 구조를 세팅한다. `npm install zustand`로 패키지를 추가하고, devtools 미들웨어를 포함한 예시 스토어 파일(`src/store/index.ts`)을 생성하여 Redux DevTools Extension과 연동되도록 구성한다.

## Completion Criteria
- zustand가 package.json dependencies에 추가되어 있다
- src/frontend/src/store/ 디렉토리가 생성되어 있다
- devtools 미들웨어가 적용된 예시 스토어 파일이 존재한다
- 브라우저 Redux DevTools Extension으로 상태를 확인할 수 있다
- TypeScript 타입이 정확히 추론된다
