# template/prompt — 워커·분석 프롬프트

**먼저 읽기:** [Agent 온보딩 / 역할 라우팅](../../../../docs/architecture/agent-onboarding.md) — 작업 전 역할을 정하고, **해당 행의 파일만** 연다.

## 파일 인덱스

| 파일 | Role ID (라우팅 표) | 비고 |
|------|---------------------|------|
| `worker-task.md` | `OrchestrationTaskWorker` | 태스크 구현. UI 리프는 scope에 dashboard 있을 때 엔진이 주입할 수 있음. |
| `worker-review.md` | `OrchestrationReviewWorker` | 리뷰만. diff에 dashboard 있을 때만 `dashboard-design-system.md`. |
| `task-suggest.md` | `TaskSuggestAgent` | JSON 제안만. UI 디자인 문서 불필요. |
| `task-analyze.md` | `TaskAnalyzeAgent` | 태스크 분해 JSON. UI 디자인 문서 불필요. |
| `task-analyze-refine.md` | `TaskAnalyzeRefineAgent` | 수정 반영 분해. 동상. |
| `night-scan.md` | `NightScanWorker` | 야간 이슈 1건 출력. |
| `night-scan-types.md` | `NightScanWorker` (보조) | 타입별 설명 조각. |
| `dashboard-design-system.md` | **UI 구현/리뷰 시만** | 컴포넌트·페이지 작업자 또는 조건부 주입. |
| `cursor-repo-behavior.md` | `CursorIDEAgent` | IDE에서 계획/구현 분리 등. |

## 변수 치환

`worker-task.md` / `worker-review.md` 등은 엔진 `renderTemplate`으로 `{{...}}`가 채워진다. `worker-task`는 `{{optional_guides}}`에 dashboard UI 본문이 **조건부**로 들어갈 수 있다.
