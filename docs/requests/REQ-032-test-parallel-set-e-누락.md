---
id: REQ-032
title: test-parallel set -e 누락
status: done
priority: medium
created: 2026-03-24
---
test-parallel-logic.sh에서 `set -uo pipefail`에 `-e` 플래그가 누락되어 명령 실패해도 스크립트가 계속 진행됨.

## 문제
- `scripts/test-parallel-logic.sh:7`
- `set -uo pipefail` → `set -euo pipefail` 이어야 함
- 테스트 실패가 마스킹되어 false positive 발생 가능

## Completion Criteria
- `set -euo pipefail`로 수정
- 의도적으로 실패를 허용하는 부분은 `|| true` 명시
