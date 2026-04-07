# src/frontend/src/lib/ 코드 리뷰 보고서

> 2026-04-07 | 54개 파일 전수 검토 (테스트 파일 제외 42개)

## 1. 삭제 대상 (2개)

| 파일 | 이유 |
|------|------|
| `request-parser.ts` | 마크다운 파일 스캔 기반 — DB가 source of truth이므로 완전히 불필요 |
| `task-id.ts` | `generateNextTaskId()`가 파일시스템 스캔 — `task-store.getNextTaskId()`와 완전 중복 |

## 2. 삭제 가능 (마이그레이션 완료 후, 1개)

| 파일 | 이유 |
|------|------|
| `task-db-sync.ts` | 마크다운→SQLite 동기화 레이어 — DB 단일 저장소 전환 완료 시 불필요 |

## 3. 레거시 코드 정리 필요 (4개)

| 파일 | 문제 | 개선 |
|------|------|------|
| `context-builder.ts` | `getDoneTaskIds()`가 여전히 파일시스템 스캔 + TASKS_DIR 미사용 import | DB 쿼리로 교체, 미사용 import 제거 |
| `auto-improve-manager.ts` | TASKS_DIR 미사용 import, `fs.readdirSync` 사용 | DB 기반으로 전환 |
| `parser.ts` | `parseTaskFile()` 함수가 파일시스템 읽기 — 사용처 없음 | 함수 삭제 |
| `paths.ts` | `TASKS_DIR`가 마크다운 폴더 참조 — DB 전환 후 의미 변경됨 | 용도 재검토 |

## 4. 중복 코드 통합 필요 (3건)

| 중복 항목 | 위치 | 개선 |
|-----------|------|------|
| `logTokenUsage()` | `job-task.ts` + `job-review.ts` 거의 동일 | 공통 유틸로 추출 |
| `SKIP_REVIEW_ROLES` | `orchestrate-engine.ts` + `task-runner-utils.ts` 동일 상수 | 한 곳에서 정의, export |
| `formatDuration` / `formatDurationMinutes` | `format-utils.ts` | 하나의 함수로 통합 (옵션 파라미터) |

## 5. 사소한 개선 (3건)

| 파일 | 문제 | 개선 |
|------|------|------|
| `model-selector.ts` | `logModelSelection()`에서 `determineComplexity()` 이중 호출 | 한 번만 호출 |
| `merge-utils.ts` | `postNotice()` HTTP 실패 시 DB 폴백 없음 | notice DB INSERT 폴백 추가 |
| `doc-tree.ts` | `readManifest()` 레거시 alias | 제거 여부 확인 |

## 6. 정상 (문제 없음, 31개)

claude-cli.ts, claude-worker.ts, cost-aggregation.ts, cost-parser.ts, cost-phase.ts, date-utils.ts, db.ts, error-utils.ts, frontmatter-utils.ts, job-review.ts (중복 외), job-task.ts (중복 외), merge-utils.ts (폴백 외), model-selector.ts (이중호출 외), monitor-types.ts, night-worker.ts, notice-parser.ts, orchestrate-engine.ts (중복 외), orchestration-manager.ts, plan-parser.ts, plan-tree.ts, prd-parser.ts, process-utils.ts, query-client.ts, query-keys.ts, run-history.ts, settings.ts, signal.ts, slug-utils.ts, task-runner-iterm.ts, task-runner-manager.ts, task-runner-types.ts, task-runner-utils.ts (중복 외), task-store.ts, template.ts, utils.ts, waterfall.ts

## 요약

| 구분 | 건수 |
|------|------|
| 삭제 대상 | 2개 파일 |
| 삭제 가능 (추후) | 1개 파일 |
| 레거시 정리 | 4개 파일 |
| 중복 통합 | 3건 |
| 사소한 개선 | 3건 |
| 정상 | 31개 파일 |
