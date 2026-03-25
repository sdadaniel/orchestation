---
id: TASK-108
title: orchestrate.sh 컨텍스트 최소화로 cache_read 절감
status: done
priority: high
sort_order: 2
created: 2026-03-24
updated: 2026-03-24
branch: task/TASK-108-context-minimize
worktree: ../repo-wt-TASK-108
role: general
reviewer_role: reviewer-general
scope:
  - scripts/orchestrate.sh
  - scripts/run-worker.sh
---
orchestrate.sh에서 Claude에게 전달하는 시스템 프롬프트와 참조 파일을 최소화한다. 현재 매 태스크 실행 시 불필요하게 포함되는 전체 docs 목록, 완료된 태스크 문서, 대형 설정 파일 등을 제거하거나 요약본으로 교체한다. 태스크 실행에 직접 필요한 파일만 참조하도록 선택적 컨텍스트 로딩 방식을 도입한다.

## Completion Criteria
- 태스크 실행 시 전달되는 참조 파일이 해당 태스크와 직접 관련된 것으로만 제한됨
- 완료된 TASK-xxx.md 및 REQ-xxx.md 파일이 신규 태스크 컨텍스트에서 제외됨
- cache_read 토큰 수가 기존 대비 유의미하게 감소함 (목표: 50% 이상)
