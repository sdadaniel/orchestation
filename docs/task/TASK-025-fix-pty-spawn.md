---
id: TASK-025
title: server.ts posix_spawnp 오류 수정
sprint: SPRINT-004
status: in_progress
priority: critical
depends_on: []
blocks: []
parallel_with: []
role: backend-dev
branch: task/TASK-025-fix-pty-spawn
worktree: ../repo-wt-TASK-025
reviewer_role: reviewer-general
affected_files:
  - src/frontend/server.ts
---

## 목표

`/terminal` 페이지 접속 시 `posix_spawnp failed` 오류가 반복 발생하는 문제를 해결한다.

## 현상

```
⨯ uncaughtException: Error: posix_spawnp failed.
    at WebSocketServer.<anonymous> (server.ts:27:28)
```

- WebSocket 연결마다 `pty.spawn()`이 호출되며, 셸 프로세스 생성에 실패
- 에러 핸들링이 없어 uncaughtException으로 서버가 불안정해짐

## 무엇을

- `src/frontend/server.ts` — pty.spawn 에러 핸들링 + 셸 경로 검증 (MODIFY)

## 어떻게

1. **셸 경로 검증**: `pty.spawn()` 호출 전에 `fs.existsSync(shell)` 로 셸 바이너리 존재 확인. 없으면 `/bin/zsh` → `/bin/bash` → `/bin/sh` 순서로 폴백
2. **try-catch 감싸기**: `pty.spawn()` 호출을 try-catch로 감싸서, 실패 시 WebSocket에 에러 메시지를 전송하고 연결을 정상 종료
3. **환경변수 정리**: `process.env`를 그대로 넘기지 말고, `undefined` 값을 가진 키를 필터링하여 깨끗한 env 객체 전달

## 입출력

- 입력: 브라우저 WebSocket 연결 요청
- 출력:
  - 성공 시: 정상 셸 세션
  - 실패 시: `[error] Failed to spawn terminal: <reason>` 메시지 후 연결 종료 (서버 크래시 없음)

## 완료 조건

- `npm run dev` 실행 후 `/terminal` 접속 시 `posix_spawnp failed` 오류가 발생하지 않음
- 셸 경로가 유효하지 않아도 서버가 크래시하지 않고 에러 메시지를 클라이언트에 전달함
- 기존 정상 동작(셸 입출력, resize, 연결 종료 시 PTY 정리)이 유지됨
