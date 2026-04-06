---
id: TASK-353
title: src/lib-Node.js-모듈-default-import-strict-타입-에러-수정
status: pending
priority: medium
mode: night
created: 2026-04-06 00:00
updated: 2026-04-06 00:00
depends_on: []
scope:
  - src/frontend/src/lib/night-worker.ts
  - src/frontend/src/lib/claude-worker.ts
  - src/frontend/src/lib/paths.ts
  - src/frontend/src/lib/settings.ts
  - src/frontend/src/lib/frontmatter-utils.ts
---
strict 모드에서 Node.js 내장 모듈(fs, path, crypto, http)과 외부 모듈(gray-matter)을 default import로 가져올 때 타입 오류 발생.

## Completion Criteria
- 모든 default import를 named import 또는 import * as 문법으로 변경
- npx tsc --noEmit --strict 실행 시 import 관련 오류 제거