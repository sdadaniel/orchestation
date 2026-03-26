---
id: TASK-159
title: 중복 타입 정의 단일 소스로 통합
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/hooks/useOrchestrationStatus.ts
  - src/frontend/src/lib/orchestration-manager.ts
  - src/frontend/src/hooks/useRunHistory.ts
  - src/frontend/src/lib/run-history.ts
  - src/frontend/src/hooks/useDocTree.ts
  - src/frontend/src/lib/doc-tree.ts
  - src/frontend/src/app/api/monitor/route.ts
  - src/frontend/src/hooks/useMonitor.ts
---

hooks/와 lib/ (또는 api/) 양쪽에 동일한 인터페이스·타입이 중복 정의되어 있다.
한쪽(lib)에서만 정의하고 나머지에서 import하도록 통합한다.

## 중복 목록

| 타입 | 파일 1 | 파일 2 |
|------|--------|--------|
| `OrchestrationStatus` | hooks/useOrchestrationStatus.ts | lib/orchestration-manager.ts |
| `RunHistoryEntry` | hooks/useRunHistory.ts | lib/run-history.ts |
| `DocNode` | hooks/useDocTree.ts | lib/doc-tree.ts |
| `DocDetail` | hooks/useDocTree.ts | lib/doc-tree.ts |
| `ClaudeProcess` | app/api/monitor/route.ts | hooks/useMonitor.ts |

## Completion Criteria

- 각 타입이 프로젝트 내 단 1곳에서만 정의된다 (lib/ 또는 types/ 파일)
- 기존 import 경로가 모두 새 경로로 갱신된다
- `npm run build` 성공 (타입 에러 없음)
- 로직 변경 없음 — export/import 경로만 수정
