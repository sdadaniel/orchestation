---
id: TASK-101
title: test-parallel-logic.sh set -euo pipefail 수정
status: done
priority: medium
sort_order: 1
sprint:
depends_on: [TASK-100]
branch: task/TASK-101-test-parallel-logicsh-set--euo
worktree: ../repo-wt-TASK-101
role: general
reviewer_role: reviewer-general
---

# TASK-101: test-parallel-logic.sh set -euo pipefail 수정

## 원본 요청

- Request: REQ-032
- 제목: test-parallel set -e 누락
- 내용: test-parallel-logic.sh에서 `set -uo pipefail`에 `-e` 플래그가 누락되어 명령 실패해도 스크립트가 계속 진행됨.

## 문제
- `scripts/test-parallel-logic.sh:7`
- `set -uo pipefail` → `set -euo pipefail` 이어야 함
- 테스트 실패가 마스킹되어 false positive 발생 가능

## Completion Criteria
- `set -euo pipefail`로 수정
- 의도적으로 실패를 허용하는 부분은 `|| true` 명시

## 완료 조건

- `scripts/test-parallel-logic.sh:7`의 `set -uo pipefail`을 `set -euo pipefail`로 수정
- 스크립트 내 의도적 실패 허용 구간(명령 실패가 정상인 부분) 확인 후 `|| true` 명시
- 수정 후 스크립트 실행하여 기존 테스트가 정상 통과하는지 확인
