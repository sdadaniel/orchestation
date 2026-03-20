---
id: TASK-017
title: Custom Server + WebSocket + node-pty 터미널 백엔드
sprint: SPRINT-003
status: backlog
priority: critical
depends_on: []
blocks:
  - TASK-018
parallel_with:
  - TASK-019
role: backend-dev
branch: task/TASK-017-terminal-server
worktree: ../repo-wt-TASK-017
reviewer_role: reviewer-general
affected_files:
  - src/frontend/server.ts
  - src/frontend/package.json
  - src/frontend/next.config.ts
---

## 목표

Next.js Custom Server에 WebSocket 엔드포인트를 추가하여 브라우저에서 서버 셸에 접속할 수 있는 백엔드를 구축한다.

## 무엇을

- `src/frontend/server.ts` — Custom Server (NEW): HTTP + WebSocket 서버
- `src/frontend/package.json` — 패키지 추가 및 dev 스크립트 변경 (MODIFY)
- `src/frontend/next.config.ts` — 필요 시 설정 조정 (MODIFY)

## 어떻게

- **패키지 설치**: `ws`, `node-pty`, `@types/ws`, `tsx`
- **Custom Server** (`server.ts`):
  1. `next()` 로 Next.js 앱 prepare
  2. `http.createServer(handler)` 로 HTTP 서버 생성
  3. `new WebSocketServer({ server })` 로 WS 서버 부착
  4. WS `connection` 이벤트에서 `node-pty.spawn(shell)` 으로 PTY 생성
  5. PTY `data` → WS `send`, WS `message` → PTY `write` 양방향 파이프
  6. WS `close` 시 PTY `kill`
- **package.json 스크립트 변경**: `"dev": "tsx server.ts"`
- **next.config.ts**: Custom Server 사용 시 필요한 설정 반영

## 입출력

- 입력: 브라우저 WebSocket 연결 요청 (`ws://localhost:3000`)
- 출력: 실시간 셸 스트림 (stdin/stdout 양방향)

## 완료 조건

- `npm run dev` 실행 시 Custom Server가 정상 기동됨
- `wscat -c ws://localhost:3000` 으로 접속하면 셸 프롬프트가 출력됨
- 명령어 입력/출력이 실시간으로 동작함
- WS 연결 종료 시 PTY 프로세스가 정리됨
