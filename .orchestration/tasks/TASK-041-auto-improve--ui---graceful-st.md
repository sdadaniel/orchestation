---
id: TASK-041
title: auto-improve 웹 UI 중단 버튼 (graceful stop)
status: done
priority: medium
sprint:
depends_on: []
branch: task/TASK-041-auto-improve--ui---graceful-st
worktree: ../repo-wt-TASK-041
role: general
reviewer_role: reviewer-general
---

# TASK-041: auto-improve 웹 UI 중단 버튼 (graceful stop)

## 원본 요청

- Request: REQ-008
- 제목: auto-improve 중단버튼
- 내용: 중간에 이거 내가 멈추고싶은 경우가 있을것 같아. 알아서 잘 넣어줘
근데 현재 진행중인 request는 처리하고 종료할 수 있어야해

## 완료 조건

- `scripts/auto-improve.sh`에 STOP_FLAG 파일 체크 로직 추가 (각 루프 반복 시작 전 확인)
- STOP_FLAG 존재 시 현재 request 처리 완료 후 정상 종료 (`break` 또는 `exit 0`)
- `src/frontend/src/lib/auto-improve-manager.ts` 싱글턴 매니저 추가 (`orchestration-manager.ts` 패턴 참고)
  - `run()`: auto-improve.sh 프로세스 시작
  - `stop()`: stop flag 파일 생성 (graceful) + 상태를 `stopping`으로 변경
  - `getStatus()`: `idle | running | stopping | completed | failed` 반환
- API 라우트 추가:
  - `POST /api/auto-improve/run`
  - `POST /api/auto-improve/stop`
  - `GET /api/auto-improve/status`
- Requests 페이지 상단에 auto-improve 제어 UI 추가:
  - idle 상태: "Run Auto-Improve" 버튼
  - running 상태: 스피너 + "Stop" 버튼
  - stopping 상태: "Stopping..." 텍스트 (버튼 비활성화)
- 프로세스 종료 시 stop flag 파일 자동 삭제
