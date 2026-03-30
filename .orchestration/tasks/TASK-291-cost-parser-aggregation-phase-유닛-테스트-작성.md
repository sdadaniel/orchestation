---
id: TASK-291
title: cost-parser/aggregation/phase 유닛 테스트 작성
status: done
branch: task/task-291
worktree: ../repo-wt-task-291
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - src/frontend/src/lib/cost-parser.ts
  - src/frontend/src/lib/cost-aggregation.ts
  - src/frontend/src/lib/cost-phase.ts
---
cost 관련 lib 3개 파일에 유닛 테스트가 전혀 없음. 정규식 파싱, 집계 로직, 퍼센트 계산 등 순수 함수가 다수 포함되어 있어 테스트 작성이 용이하고 효과가 큼.

테스트 대상 함수:
- `parseCostLogLine`: new format(model 포함) / legacy format / 빈 줄 / model_selection 제외
- `aggregateByTask`: 복수 엔트리 집계, 모델명 병합, costUsd 소수점 처리
- `shortenModelName`: opus/sonnet/haiku 패턴, claude-3-5-haiku 패턴, unknown, fallback
- `aggregateByModel`: 모델별 집계 및 정렬
- `aggregateCostByPhase`: phase별 비용 합산 및 퍼센트 계산, total=0 엣지 케이스

## Completion Criteria
- Vitest 기반 테스트 파일 생성 (`src/frontend/src/lib/__tests__/cost-parser.test.ts` 등)
- `parseCostLogLine` new/legacy/빈줄/무효 라인 케이스 커버
- `aggregateByTask` 복수 태스크 집계 정확성 검증
- `shortenModelName` 주요 모델명 패턴 검증
- `aggregateByModel` 정렬 순서 검증
- `aggregateCostByPhase` total=0 엣지 케이스 포함
- 모든 테스트 통과
