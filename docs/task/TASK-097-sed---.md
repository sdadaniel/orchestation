---
id: TASK-097
title: sed 크로스플랫폼 호환성 수정
status: pending
priority: medium
sprint:
depends_on: [TASK-096]
branch: task/TASK-097-sed---
worktree: ../repo-wt-TASK-097
role: general
reviewer_role: reviewer-general
---

# TASK-097: sed 크로스플랫폼 호환성 수정

## 원본 요청

- Request: REQ-024
- 제목: sed 크로스플랫폼 호환성
- 내용: 여러 쉘 스크립트에서 macOS 전용 `sed -i ''` 문법 사용으로 Linux에서 실행 불가.

## 문제
- `scripts/orchestrate.sh:159,223`, `run-pipeline.sh:109`, `auto-improve.sh:38`, `test-parallel-logic.sh:200`
- `sed -i ''`는 macOS BSD sed 전용, GNU sed는 `-i` 만 사용

## Completion Criteria
- OS 감지 후 적절한 sed 옵션 사용 또는 임시파일+mv 패턴으로 교체
- macOS와 Linux 모두에서 정상 동작

## 완료 조건

- `scripts/orchestrate.sh:159,223`, `run-pipeline.sh:109`, `auto-improve.sh:38`, `test-parallel-logic.sh:200`의 `sed -i ''` 구문을 크로스플랫폼 방식으로 교체
- OS 감지(`uname`) 후 macOS는 `sed -i ''`, Linux는 `sed -i` 사용하는 헬퍼 함수 도입 또는 임시파일+mv 패턴으로 일괄 교체
- macOS와 Linux 양쪽에서 동작 확인
