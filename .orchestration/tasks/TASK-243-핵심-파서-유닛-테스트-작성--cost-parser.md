---
id: TASK-243
title: 핵심 파서 유닛 테스트 작성 (cost-parser, notice-parser, parser)
status: failed
branch: task/task-243
worktree: ../repo-wt-task-243
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope: []
---
프로젝트에 유닛 테스트가 전혀 없고 Vitest가 설정만 되어 있습니다. 파서 라이브러리들이 순수 함수로 테스트하기 가장 적합합니다.

---
id: TASK-243
title: 핵심 파서 유닛 테스트 작성 (cost-parser, notice-parser, parser)
status: failed
branch: task/task-243
worktree: ../repo-wt-task-243
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/parser.ts
  - src/frontend/src/lib/cost-parser.ts
  - src/frontend/src/lib/notice-parser.ts
  - src/frontend/vitest.config.ts
---
프로젝트에 유닛 테스트가 0개인 상태. Vitest가 설정되어 있으나 테스트 파일이 없음.
가장 테스트 가치가 높은 3개 파서 모듈에 대해 유닛 테스트를 작성한다.

- `parser.ts`: `toTaskStatus`, `toTaskPriority`, `parseTaskFile` 함수의 정상/비정상 입력 테스트
- `cost-parser.ts`: `parseCostLogLine` 함수의 new format, legacy format, 빈 줄 처리 테스트
- `notice-parser.ts`: `parseNoticeFile` 함수의 정상 파싱, 빈 frontmatter, 파일 없음 처리 테스트

파일 시스템 의존은 모킹 처리하고, 순수 파싱 로직 위주로 검증한다.

## Completion Criteria
- `src/frontend/src/lib/__tests__/parser.test.ts` 생성 및 최소 6개 테스트 케이스
- `src/frontend/src/lib/__tests__/cost-parser.test.ts` 생성 및 최소 4개 테스트 케이스
- `src/frontend/src/lib/__tests__/notice-parser.test.ts` 생성 및 최소 4개 테스트 케이스
- `npx vitest run` 실행 시 전체 통과
- 기존 코드 로직 변경 없음
