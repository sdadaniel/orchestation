---
id: TASK-047
title: Task 상세 페이지에 로그 탭 추가
status: backlog
priority: high
sprint:
depends_on: [TASK-046]
branch: task/TASK-047-task-----
worktree: ../repo-wt-TASK-047
role: general
reviewer_role: reviewer-general
---

# TASK-047: Task 상세 페이지에 로그 탭 추가

## 원본 요청

- Request: REQ-015
- 제목: Task 상세 페이지에 로그 탭 추가
- 내용: 현재 진행 중인 Task 상세 페이지에 로그 탭을 추가하여 태스크 실행 중 발생하는 로그를 실시간으로 확인할 수 있게 한다. 탭 UI를 구성하고 태스크 로그 데이터를 API로 조회하여 표시한다.

## Completion Criteria
- Task 상세 페이지에 '로그' 탭이 추가된다
- 로그 탭 클릭 시 해당 태스크의 실행 로그 목록이 표시된다
- 로그 항목에는 타임스탬프, 로그 레벨(info/warn/error), 메시지가 포함된다
- in_progress 상태의 태스크에서 로그가 자동으로 폴링(주기적 갱신)된다
- 로그가 없을 경우 빈 상태 메시지가 표시된다

## 완료 조건

- Task 상세 페이지에 '개요'/'로그' 탭 UI 추가
- 로그 탭 클릭 시 해당 태스크의 실행 로그 목록 표시
- 로그 항목: 타임스탬프, 로그 레벨(info/warn/error), 메시지 포함
- in_progress 상태일 때 로그 자동 폴링(주기적 갱신) 구현
- 로그 없을 경우 빈 상태 메시지 표시
- 태스크 로그 조회 API 엔드포인트 연동
