---
id: REQ-009
title: auto-improve 병렬 처리
status: done
priority: high
created: 2026-03-23
---

auto-improve.sh에서 pending request를 1개씩 순차 처리하지 말고, 독립적인 request들은 동시에 처리해줘.

구체적으로:
- pending request를 모두 수집
- Claude에게 각 request가 서로 독립적인지 판단시킴
- 독립적인 것들은 Task를 한번에 여러 개 생성
- orchestrate.sh 1회 실행으로 배치 0에서 병렬 처리
- 의존적인 것들은 기존처럼 순차 처리
