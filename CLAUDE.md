# CLAUDE.md

레포 전역에서 **모두** 지켜야 하는 것만 둔다.

**작업 전:** 역할을 정한 뒤 [Agent 온보딩 / 역할 라우팅](docs/architecture/agent-onboarding.md) 표에 따라 **해당 가이드만** 읽는다. 프롬프트·워커 인덱스: [packages/dashboard/template/prompt/README.md](packages/dashboard/template/prompt/README.md).

## 환경

- macOS bash 3.x — `declare -A`, `mapfile`, `readarray` 사용 금지
- Shell에서 `claude` CLI 호출 시 full PATH 사용 또는 사전 resolve

## 태스크 상태 (엔진·대시보드 공통)

- 유효: `pending`, `stopped`, `in_progress`, `reviewing`, `done`, `failed`, `rejected`
- 새 태스크: `status`는 반드시 `pending`
- `failed` / `rejected` / `done`: 종료 — 큐가 자동 재픽업하지 않음 (수동 복구)
- `failed`: 엔진 크래시, 리뷰 retry 상한 초과, 비용 상한 초과, 머지 실패 등 비의도적 종료
- Sprint 사용 안 함
