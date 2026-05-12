# Agent 온보딩 — 오케스트레이션 레포

코드·문서를 바꾸기 **전에** 반드시 이 페이지의 **역할 라우팅**을 따른다. 다른 역할용 가이드(예: 대시보드 UI 전체 규칙)는 **라우팅 표에 없으면 읽지 않는다.**

## 레포 구조 (한눈에)

| 경로 | 역할 |
|------|------|
| `packages/engine` | 태스크 스토어, 오케스트 엔진, `job-task` / `step-runner`, Claude 워커 호출 |
| `packages/dashboard` | Next.js 대시보드, `/api/tasks/*`, UI |
| `.orchestration/` | 로컬 DB(`orchestration.db`), `output/`, `template/` 심링크/복사본 등 런타임 데이터 |
| `packages/dashboard/template/prompt/` | 워커·분석용 **프롬프트 템플릿** (Markdown) |

프롬프트 조립: [`packages/engine/src/orchestrate/ops/context-builder.ts`](../../packages/engine/src/orchestrate/ops/context-builder.ts) — `buildTaskPrompt` / `buildReviewPrompt`가 `template/prompt/*.md`를 읽고 `{{변수}}`를 치환한다.

태스크 상태·큐 규약: 루트 [`CLAUDE.md`](../../CLAUDE.md) (짧게 유지).

## 역할 라우팅 (필수 워크플로)

1. **역할 확정**: 아래 표의 **Role ID** 중 지금 세션에 해당하는 하나를 고른다.
2. **읽기 범위**: **Layer 0(이 문서)** + 표에 적힌 **Layer 1 / Layer 2**만 연다. 다른 행의 파일은 근거로 쓰지 않는다.
3. **작업**: 읽기 범위 밖 가이드를 인용·요구하지 않는다.

### 라우팅 표

| Role ID | 언제 해당하는가 | 필수 읽기 | 선택·조건부 읽기 |
|---------|-----------------|-----------|------------------|
| `OrchestrationTaskWorker` | 엔진이 `worker-task.md`로 Claude 태스크 실행 | 이 문서 + [`worker-task.md`](../../packages/dashboard/template/prompt/worker-task.md) | `dashboard-design-system.md`는 **엔진이 scope에 `packages/dashboard`를 포함할 때만** 프롬프트에 주입됨(직접 열지 않아도 됨). 주입이 없으면 **열지 않는다**. |
| `OrchestrationReviewWorker` | `worker-review.md`로 리뷰 단계 | 이 문서 + [`worker-review.md`](../../packages/dashboard/template/prompt/worker-review.md) | diff에 `packages/dashboard`가 있을 때만 [`dashboard-design-system.md`](../../packages/dashboard/template/prompt/dashboard-design-system.md)를 연다. |
| `TaskSuggestAgent` | 태스크 제안 API가 `task-suggest.md` 사용 | 이 문서 + [`task-suggest.md`](../../packages/dashboard/template/prompt/task-suggest.md) | UI 디자인 시스템 문서 **불필요**. |
| `TaskAnalyzeAgent` | 태스크 분해 API가 `task-analyze.md` 사용 | 이 문서 + [`task-analyze.md`](../../packages/dashboard/template/prompt/task-analyze.md) | UI 디자인 시스템 전체 문서 **불필요**. (요청에 UI가 있으면 `criteria`에 UX 항목만 반영.) |
| `TaskAnalyzeRefineAgent` | `task-analyze-refine.md` | 이 문서 + 해당 템플릿 | 동상. |
| `NightScanWorker` | 야간 스캔 `night-scan.md` / 타입별 `night-scan-types.md` | 이 문서 + 해당 템플릿 | UI 디자인 시스템 **불필요** (스캔 목적이 아니면). |
| `CursorIDEAgent` | Cursor 등 IDE에서 일반 편집·리팩터 | 이 문서 + [`cursor-repo-behavior.md`](../../packages/dashboard/template/prompt/cursor-repo-behavior.md) | 대시보드 UI 작업 시에만 [`dashboard-design-system.md`](../../packages/dashboard/template/prompt/dashboard-design-system.md). |

템플릿별 한 줄 요약: [`packages/dashboard/template/prompt/README.md`](../../packages/dashboard/template/prompt/README.md).

## 데이터 흐름 (태스크)

1. 대시보드/API가 `tasks` DB 행을 읽고 쓴다.
2. 엔진이 `pending` 태스크를 집어 `work` / `review` 스텝을 실행한다.
3. `runJobTask`가 DB에서 태스크를 읽고, `buildTaskPrompt`로 사용자 메시지를 만든 뒤 Claude를 호출한다.
4. 결과는 `.orchestration/output/` 등에 JSON으로 남는다.

워크트리·브랜치: 태스크 행의 `branch` / `worktree` 필드 — 엔진이 생성·정리할 수 있다.

## 관련 링크

- [`CLAUDE.md`](../../CLAUDE.md) — 환경, 태스크 상태 규약만
- [`packages/dashboard/template/prompt/README.md`](../../packages/dashboard/template/prompt/README.md) — 프롬프트 파일 인덱스
