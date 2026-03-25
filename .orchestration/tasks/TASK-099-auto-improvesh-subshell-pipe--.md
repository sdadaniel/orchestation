---
id: TASK-099
title: auto-improve.sh subshell pipe 패턴을 process substitution으로 교체
status: done
priority: medium
sprint:
depends_on: [TASK-098]
branch: task/TASK-099-auto-improvesh-subshell-pipe--
worktree: ../repo-wt-TASK-099
role: general
reviewer_role: reviewer-general
---

# TASK-099: auto-improve.sh subshell pipe 패턴을 process substitution으로 교체

## 원본 요청

- Request: REQ-030
- 제목: auto-improve subshell pipe 문제
- 내용: auto-improve.sh에서 pipe + while 루프가 subshell에서 실행되어 루프 내 변수 변경이 부모 셸에 전파되지 않음.

## 문제
- `scripts/auto-improve.sh:278, 373, 467`
- `cmd | while read` 패턴에서 while은 subshell → 변수 변경 유실
- orchestration 에러가 조용히 무시됨

## Completion Criteria
- process substitution(`while read < <(cmd)`) 또는 임시파일 패턴으로 교체
- 루프 내 변수 변경이 정상 전파되고 에러가 감지됨

## 완료 조건

- `scripts/auto-improve.sh` 278, 373, 467번 라인의 `cmd | while read` 패턴을 `while read ... < <(cmd)` 형태로 교체
- 루프 내 변수 변경이 부모 셸에 정상 전파되는지 확인
- orchestration 에러 발생 시 루프 종료 또는 에러 전파가 정상 동작하는지 확인
