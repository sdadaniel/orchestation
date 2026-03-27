---
id: TASK-286
title: frontend lib/ 순수 함수 유닛 테스트 추가
status: pending
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:  []
---

TASK-286은 이미 예약되어 있으므로 TASK-287로 생성합니다.

---
id: TASK-287
title: frontend lib/ 순수 함수 유닛 테스트 추가
status: pending
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - src/frontend/src/lib/frontmatter-utils.ts
  - src/frontend/src/lib/parser.ts
  - src/frontend/src/lib/task-id.ts
  - src/frontend/src/lib/cost-aggregation.ts
  - src/frontend/src/lib/cost-phase.ts
---
frontend lib/ 디렉토리의 순수 함수들에 대한 vitest 유닛 테스트가 전무함. 현재 vitest 설정은 Storybook stories만 대상으로 하며, 핵심 파싱/집계 로직에 대한 테스트가 없음.

대상 모듈:
- `frontmatter-utils.ts`: parseFrontmatter, getString, getBool, getInt, getStringArray
- `parser.ts`: parseTask, status/priority 유효성 검증
- `task-id.ts`: generateNextTaskId
- `cost-aggregation.ts`: shortenModelName, aggregateByModel
- `cost-phase.ts`: aggregateCostByPhase

작업 내용:
1. vitest config에 unit test project 추가 (storybook 프로젝트와 병렬)
2. 각 모듈별 `*.test.ts` 파일 생성
3. 정상 입력, 경계값, 잘못된 입력에 대한 케이스 커버

## Completion Criteria
- 5개 모듈 각각에 대응하는 `.test.ts` 파일 존재
- `npx vitest run` 시 모든 테스트 통과
- 각 함수의 정상/비정상 입력 케이스 최소 2개씩 포함

## Completion Criteria


