---
id: TASK-042
title: auto-improve 병렬 처리 구현
status: done
priority: high
sprint:
depends_on: []
branch: task/TASK-042-auto-improve---
worktree: ../repo-wt-TASK-042
role: general
reviewer_role: reviewer-general
---

# TASK-042: auto-improve 병렬 처리 구현

## 원본 요청

- Request: REQ-009
- 제목: auto-improve 병렬 처리
- 내용: 
auto-improve.sh에서 pending request를 1개씩 순차 처리하지 말고, 독립적인 request들은 동시에 처리해줘.

구체적으로:
- pending request를 모두 수집
- Claude에게 각 request가 서로 독립적인지 판단시킴
- 독립적인 것들은 Task를 한번에 여러 개 생성
- orchestrate.sh 1회 실행으로 배치 0에서 병렬 처리
- 의존적인 것들은 기존처럼 순차 처리

## 완료 조건

- pending request 전체 수집 로직 구현
- Claude API를 통해 각 request 간 의존성 판단 (독립/의존 분류)
- 독립적인 request들을 단일 orchestrate.sh 실행으로 배치 0에서 병렬 처리되도록 Task 일괄 생성
- 의존적인 request들은 기존 순차 처리 흐름 유지
- 병렬/순차 처리 결과를 로그로 출력
