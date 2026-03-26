---
id: TASK-226
title: server.ts-중복-fs-import-통합
status: pending
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/server.ts
---
`src/frontend/server.ts`에서 `fs` 모듈이 중복 import되어 있음.

- 라인 2: `import fs from "fs";` (default import)
- 라인 8: `import { appendFileSync } from "fs";` (named import)

두 import를 하나로 통합한다: `import fs, { appendFileSync } from "fs";`

## Completion Criteria
- `fs` 모듈 import가 단일 구문으로 통합됨
- 기존 `fs.readFileSync`, `fs.existsSync` 등 default import 사용처가 정상 동작
- `appendFileSync` named import 사용처가 정상 동작
- 빌드 에러 없음
