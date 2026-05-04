# 대시보드 Claude CLI · 비용 로그 설계 메모

> `spawnClaude`, CLI 출력 포맷, `/cost` 표시, 클라이언트 번들 제약을 한 문서에 정리한다.

## 현재 상태 (2026-05-04)

### `spawnClaude`가 하지 않는 것

- 구현 위치: `[packages/engine/src/lib/ai/claude-cli.ts](../../packages/engine/src/lib/ai/claude-cli.ts)`
- **역할**: `claude` 프로세스 spawn, `stdin`에 프롬프트 기록, `--output-format`·`--model`·`extraArgs` 적용, 타임아웃 시 `SIGTERM`.
- **하지 않음**: stdout/stderr를 파일로 저장, usage·비용 파싱, `token-usage.log` 기록.

이유는 아래 **출력 포맷별 usage 추출**과 **채팅 스트리밍**이 호출부에서 stdout 소비 방식을 강하게 바꾸기 때문이다. “한곳 일괄”은 `**spawnClaude` 래퍼**(예: 대시보드 전용 `runClaudeWithCostLog`)로 두는 편이 낫고, `spawnClaude` 본체에 전부 넣으면 분기·tee가 커진다.

### 비용 로그는 어디서 쓰나


| 경로                                  | 기록 함수                                                                      | 저장                                               |
| ----------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| 오케스트레이션 task/review                 | `[logTokenUsage](../../packages/engine/src/service/token-logger.ts)`       | `token-usage.log` + (가능 시) SQLite `token_usage`  |
| 대시보드 API (chat / suggest / analyze) | `[logDashboardAiUsage](../../packages/engine/src/service/token-logger.ts)` | `**token-usage.log`만** (`task_id` FK 때문에 DB 미사용) |


호출부 예시:

- `[packages/dashboard/src/app/api/chat/route.ts](../../packages/dashboard/src/app/api/chat/route.ts)`
- `[packages/dashboard/src/app/api/tasks/suggest/route.ts](../../packages/dashboard/src/app/api/tasks/suggest/route.ts)`
- `[packages/dashboard/src/app/api/tasks/analyze/route.ts](../../packages/dashboard/src/app/api/tasks/analyze/route.ts)`

대시보드 무태스크 한 줄 포맷은 `token-logger` 주석과 `[cost-parser](../../packages/engine/src/parser/cost-parser.ts)`의 `LOG_LINE_REGEX_DASHBOARD`가 맞물리도록 유지한다.

### `/cost` 페이지가 읽는 소스

- API: `[packages/dashboard/src/app/api/costs/route.ts](../../packages/dashboard/src/app/api/costs/route.ts)` → `[parseCostLog()](../../packages/engine/src/parser/cost-parser.ts)`
- **파일만** 읽는다: `OUTPUT_DIR/token-usage.log` (경로는 `[paths.ts](../../packages/engine/src/lib/config/paths.ts)`의 `OUTPUT_DIR`).

태스크 요약 카드의 “Tasks” 집계는 `[aggregateByTask](../../packages/engine/src/parser/cost-parser.ts)`에서 `**TASK-`로 시작하는 행만** 포함한다. 대시보드 행은 `taskId`가 비어 있고 요약에서는 제외된다.

---

## 문제: CLI `--output-format`마다 usage 뽑는 방법이 다름

Claude CLI는 포맷에 따라 **stdout 형태**가 완전히 다르다. 그래서 **같은 파서로 처리할 수 없고**, `spawnClaude` 안에서만 통일하기 어렵다.

### 요약 표


| `output-format`   | stdout 형태                | usage(비용·토큰)                                                                 |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `**text`** (기본)   | 답변 **평문**                | stdout만으로는 **없음**. 비용 추적하려면 `json` 또는 `stream-json` 필요                       |
| `**json`**        | 프로세스 종료 시 **JSON 한 덩어리** | 루트 객체에서 `total_cost_usd` / `usage` 등 파싱. 비즈니스 응답은 보통 `result` 문자열 안에 중첩 JSON |
| `**stream-json`** | **줄 단위 JSONL** (이벤트 스트림) | `type === "result"`인 줄에서만 usage. 그 전 줄은 `stream_event` 등으로 **텍스트 델타**만 옴     |


### 코드 기준 참고

- 공통 파싱·폴백: `[packages/engine/src/lib/ai/claude-cli-result.ts](../../packages/engine/src/lib/ai/claude-cli-result.ts)` (`parseClaudePrintJsonEnvelope`, `handleStreamJsonLine`, `usageFromCliResultRoot`)
- 엔진 스트림 패턴(동일 CLI 계열): `[runClaudeStreamJson](../../packages/engine/src/orchestrate/claude/claude-worker.ts)`

### 채팅 API가 특히 다른 이유

`stream-json`은 **진행 중**에 줄을 나눠 읽으면서 사용자에게 **텍스트 델타**를 흘려보내야 한다. `spawnClaude`가 stdout을 독점해 “끝나고 한 번만” 처리하면 스트리밍과 충돌한다. 그래서 **라우트(또는 전용 래퍼)**에서 버퍼링·`handleStreamJsonLine`·`ReadableStream` enqueue를 같이 다룬다.

---

## 문제: Next 클라이언트 번들에 `fs`가 끌려 들어감

`[cost-parser.ts](../../packages/engine/src/parser/cost-parser.ts)`는 상단에서 `fs`와 `OUTPUT_DIR`(→ `[paths.ts](../../packages/engine/src/lib/config/paths.ts)`의 `fs`)를 쓴다.

**클라이언트 컴포넌트**가 `cost-parser`에서 **값**을 import하면 번들이 `cost-parser` 전체를 따라가며 `Can't resolve 'fs'` 빌드 오류가 난다.

### 대응

- `**TASK-`* 여부만 필요한 헬퍼**는 Node 의존 없는 `[packages/engine/src/parser/cost-task-scope.ts](../../packages/engine/src/parser/cost-task-scope.ts)`의 `isOrchestrationTaskCostEntry`만 클라이언트에서 import한다.
- `CostEntry` 등 **타입만** 필요하면 `import type { ... } from "@/parser/cost-parser"`처럼 **type-only**로 제한한다.

---

## 이후 개선 아이디어 (미구현)

- 대시보드 전용 `**runClaudeJsonWithCostLog` / `runClaudeStreamWithCostLog`** 래퍼로 “로그 + 파싱”을 한 파일에 모으고, 라우트는 얇게 유지.
- `text` 포맷을 쓰는 경로가 남아 있으면 **비용 추적 불가**임을 주석·문서로 명시.

