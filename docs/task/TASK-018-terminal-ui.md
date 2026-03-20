---
id: TASK-018
title: xterm.js 터미널 컴포넌트 + /terminal 페이지
sprint: SPRINT-003
status: backlog
priority: critical
depends_on:
  - TASK-017
blocks: []
parallel_with: []
role: frontend-dev
branch: task/TASK-018-terminal-ui
worktree: ../repo-wt-TASK-018
reviewer_role: reviewer-general
affected_files:
  - src/frontend/src/components/terminal/TerminalView.tsx
  - src/frontend/src/app/terminal/page.tsx
---

## 목표

xterm.js 기반 터미널 컴포넌트를 구현하고 `/terminal` 페이지에 마운트한다.

## 무엇을

- `src/frontend/src/components/terminal/TerminalView.tsx` — 터미널 컴포넌트 (NEW)
- `src/frontend/src/app/terminal/page.tsx` — 터미널 페이지 (NEW)

## 어떻게

- **패키지 설치**: `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`
- **TerminalView 컴포넌트**:
  1. `useRef` 로 터미널 컨테이너 DOM 참조
  2. `useEffect` 에서 `Terminal` 인스턴스 생성 + `FitAddon`, `WebLinksAddon` 로드
  3. `WebSocket` 연결 (TASK-017 서버)
  4. `terminal.onData` → WS `send`, WS `onmessage` → `terminal.write` 양방향 파이프
  5. `FitAddon.fit()` 으로 컨테이너 크기에 맞춤
  6. `ResizeObserver` 로 리사이즈 대응
  7. 언마운트 시 WS close + Terminal dispose
- **터미널 페이지** (`/terminal`):
  - `TerminalView` 를 전체 높이로 렌더링
  - `"use client"` 지정

## 입출력

- 입력: WebSocket 서버 주소 (TASK-017)
- 출력: 브라우저 내 인터랙티브 터미널

## 완료 조건

- `/terminal` 접속 시 셸 프롬프트가 표시됨
- 키 입력이 서버로 전송되고 응답이 터미널에 출력됨
- 브라우저 창 리사이즈 시 터미널이 자동 맞춤됨
- 페이지 이탈 시 WebSocket 연결이 정리됨
