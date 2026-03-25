---
id: TASK-040
title: 웹 UI에서 auto-improve 실행 및 진행 상태 표시
status: done
priority: high
sprint:
depends_on: []
branch: task/TASK-040--ui-auto-improve-----
worktree: ../repo-wt-TASK-040
role: general
reviewer_role: reviewer-general
---

# TASK-040: 웹 UI에서 auto-improve 실행 및 진행 상태 표시

## 원본 요청

- Request: REQ-007
- 제목: auto-improve 실행
- 내용: auto-improve 실행을 웹에서 할 수 있도록 해줘, 그리고 지금 진행중인 상태인지 아닌지 알고싶은데 표시해주고.

## 완료 조건

- 웹 UI에 "auto-improve 실행" 버튼 추가
- 버튼 클릭 시 백엔드 API를 통해 auto-improve 스크립트 실행
- auto-improve 프로세스가 실행 중일 때 진행 중 상태(스피너 또는 뱃지) 표시
- 실행 중에는 버튼 비활성화 처리
- 실행 완료/종료 시 상태가 idle로 복귀
