---
id: TASK-276
title: 비용-집계-유틸리티-단위-테스트-작성
status: pending
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:  []
---

TASK-270은 파서 모듈 5개를 커버합니다. 비용 집계 모듈(`cost-aggregation.ts`, `cost-phase.ts`)은 순수 함수이면서 테스트가 없고 TASK-270 scope에도 포함되지 않습니다.

---
id: TASK-276
title: 비용-집계-유틸리티-단위-테스트-작성
status: pending
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/lib/cost-aggregation.ts
  - src/frontend/src/lib/cost-phase.ts
---
`cost-aggregation.ts`와 `cost-phase.ts`는 비용 데이터를 모델별·페이즈별로 집계하는 순수 함수 모듈이나 단위 테스트가 전혀 없다. TASK-270(파서 테스트)과 범위가 겹치지 않으므로 별도 태스크로 테스트를 작성한다.

대상 함수:
- `shortenModelName()` — 모델 식별자를 축약 표시명으로 변환 (정규식 분기 3개)
- `aggregateByModel()` — CostEntry 배열을 모델별로 집계·정렬
- `aggregateCostByPhase()` — CostEntry 배열을 phase(task/review/other)별로 집계, 퍼센트 문자열 생성

## Completion Criteria
- `cost-aggregation.test.ts` 생성: `shortenModelName` 정규식 분기별 케이스 + `aggregateByModel` 정상/빈 배열/unknown 모델 케이스
- `cost-phase.test.ts` 생성: `aggregateCostByPhase` 정상/빈 배열/total 0일 때 퍼센트 처리 케이스
- `npx vitest run` 전체 통과

## Completion Criteria


