# 비용 상한 로직 개선

## 현재 상태 (2026-04-13)

- `src/frontend/src/lib/orchestrate-engine.ts:97` — `MAX_TASK_COST = 5.0` (달러)
- `checkCostLimit()`은 **`review-rejected` 시그널이 들어올 때만** 호출됨
- 즉, 태스크 실행 중(Claude CLI가 stream-json으로 돌고 있는 동안)에는 누적 비용을 감시하지 않음
- 단일 실행으로 $5를 넘기는 프롬프트가 있어도 중간에 abort되지 않음
- 리뷰 retry 루프 밖에서 발생한 비용 폭주는 사후에만 감지됨

## 개선 옵션

### Option A: 상한값만 낮추기
- `MAX_TASK_COST`를 $1 등으로 조정
- 설정 파일(`config.json` 또는 `settings`)에서 튜닝 가능하도록 노출
- 가장 작은 변경, 하지만 "실행 중 abort" 문제는 해결 안 됨

### Option B: 실행 중 라이브 모니터링 + abort
- `claude-worker.ts`의 `runClaudeStreamJson()`에서 stream-json 라인을 파싱할 때
  `usage.input_tokens`, `usage.output_tokens`로 누적 비용 계산
- 임계치 초과 시 `proc.kill("SIGTERM")` + 상한 초과 사유로 task-failed 시그널
- 고려사항:
  - stream-json에서 mid-stream cost 이벤트가 주기적으로 오는지 확인 필요
  - 없으면 토큰 카운트로 추정 (모델별 단가 × 누적 토큰)
  - abort 시 부분 작업이 worktree에 남을 수 있음 → 정리 로직 필요

### Option C: 태스크별 상한 override
- frontmatter에 `max_cost_usd` 필드 지원
- 중요한 태스크는 높게, 실험적 태스크는 낮게 설정 가능

## 권장 순서

1. Option A 먼저 (값 조정 + 설정 노출) — 즉시 효과
2. Option B 추가 — 실행 중 폭주 방지 (가장 효과적)
3. Option C는 필요시 추가

## 관련 파일

- `src/frontend/src/lib/orchestrate-engine.ts:97,543-560` — 상한 상수 및 체크 로직
- `src/frontend/src/lib/claude-worker.ts:78-111` — stream-json 파싱 (abort 훅 추가 지점)
- `src/frontend/src/lib/settings.ts` — 설정 파일 노출 시 추가 위치
