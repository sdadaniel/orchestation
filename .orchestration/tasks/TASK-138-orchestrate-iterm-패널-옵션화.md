---
id: TASK-138
title: orchestrate.sh iTerm 패널 실행을 옵션으로 전환
status: done
branch: task/task-138
worktree: ../repo-wt-task-138
priority: medium
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - scripts/orchestrate.sh
  - scripts/run-worker.sh
  - scripts/lib/close-iterm-session.sh
  - src/frontend/src/app/settings/page.tsx
  - config.json
---

## 목표
현재 orchestrate.sh는 태스크 실행 시 항상 iTerm 패널을 열어서 run-worker.sh를 실행한다. 이를 옵션으로 전환하여 iTerm 없이 백그라운드로 실행하는 모드를 기본으로 하고, 필요 시 iTerm 모드를 켤 수 있도록 한다.

## 현재 동작
- `start_task()` → osascript로 iTerm split pane 생성 → write text로 run-worker.sh 실행
- 완료 시 `close-iterm-session.sh`로 패널 닫기 시도

## 구현

### 1. 실행 모드 옵션 추가
- `config.json`에 `workerMode` 설정 추가: `"background"` (기본) | `"iterm"`
- 환경변수로도 오버라이드 가능: `WORKER_MODE=iterm ./scripts/orchestrate.sh`
- Settings 페이지에서 토글 가능

### 2. background 모드 (기본)
- `start_task()`에서 iTerm 대신 `nohup bash run-worker.sh TASK-ID > output/logs/TASK-ID.log 2>&1 &`
- PID를 파일로 저장 (`/tmp/worker-TASK-ID.pid`)하여 stop 시 kill 가능
- 로그는 기존 파일 경로 유지 → 프론트 로그 탭에서 표시

### 3. iterm 모드 (옵션)
- 기존 로직 그대로 유지
- `close-iterm-session.sh`도 유지

### 4. Settings UI
- workerMode 토글: "백그라운드 실행" / "iTerm 터미널 실행"

## Completion Criteria
- 기본 모드(background)로 orchestrate 실행 시 iTerm 안 뜸
- 로그가 파일로 정상 기록되어 프론트에서 확인 가능
- config에서 iterm 모드로 전환 시 기존처럼 iTerm 패널 생성
- stop 시 background 프로세스 정상 종료
