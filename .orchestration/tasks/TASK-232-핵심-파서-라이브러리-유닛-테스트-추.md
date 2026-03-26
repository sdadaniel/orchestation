---
id: TASK-232
title: 핵심 파서 라이브러리 유닛 테스트 추가
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/task-log-parser.ts
  - src/frontend/src/lib/cost-parser.ts
  - src/frontend/src/lib/sprint-parser.ts
  - src/frontend/src/lib/notice-parser.ts
  - src/frontend/src/lib/plan-parser.ts
  - src/frontend/src/lib/prd-parser.ts
  - src/frontend/src/lib/request-parser.ts
---
프로젝트에 Vitest가 설정되어 있으나 유닛 테스트가 전혀 없음. 가장 테스트 가치가 높은 7개 파서 라이브러리에 대해 유닛 테스트를 작성한다.

각 파서 파일 옆에 `*.test.ts` 파일을 생성하고, 정상 입력 / 빈 입력 / 잘못된 형식 입력에 대한 기본 테스트 케이스를 작성한다.

## Completion Criteria
- 7개 파서 각각에 대응하는 `.test.ts` 파일 존재
- 각 테스트 파일에 최소 3개 테스트 케이스 (정상, 빈 입력, 비정상 입력)
- `npx vitest run` 실행 시 전체 테스트 통과
- 기존 파서 로직 변경 없음
