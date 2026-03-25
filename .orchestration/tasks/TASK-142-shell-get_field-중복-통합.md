---
id: TASK-142
title: shell get_field() 중복 구현 통합
status: done
branch: task/task-142
worktree: ../repo-wt-task-142
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - scripts/orchestrate.sh
  - scripts/auto-improve.sh
  - scripts/collect-requests.sh
  - scripts/lib/context-builder.sh
  - scripts/lib/model-selector.sh
  - scripts/lib/common.sh
---

## 문제

YAML frontmatter에서 필드를 추출하는 `get_field()` 함수가 5개 스크립트에 각각 독립적으로 구현되어 있다.

| 파일 | 함수명 | 구현 방식 |
|------|--------|-----------|
| `scripts/orchestrate.sh` (L75-91) | `get_field()`, `get_list()` | `awk` 기반 |
| `scripts/auto-improve.sh` (L43-46) | `get_field()` | `sed` 기반 |
| `scripts/collect-requests.sh` (L16-19) | `get_field()` | 별도 구현 |
| `scripts/lib/context-builder.sh` (L6-12) | `_cb_get_field()` | 접두사 네이밍 |
| `scripts/lib/model-selector.sh` (L10-16) | `_ms_get_field()` | 접두사 네이밍 |

`awk` vs `sed` 등 구현 방식이 달라 엣지 케이스에서 결과가 달라질 수 있으며, 버그 수정 시 5곳을 모두 수정해야 한다.

## 해결 방안

1. `scripts/lib/common.sh`에 정규화된 `get_field()` 및 `get_list()` 함수를 정의한다.
2. 각 스크립트에서 `source "$(dirname "$0")/lib/common.sh"` (또는 적절한 경로)로 공통 함수를 로드한다.
3. 기존 로컬 구현을 제거하고 공통 함수로 대체한다.
4. 기존 동작이 변경되지 않는지 확인한다.

## Completion Criteria

- [ ] `scripts/lib/common.sh`에 `get_field()`, `get_list()` 공통 함수가 정의됨
- [ ] 5개 스크립트 모두 공통 함수를 source하여 사용
- [ ] 각 스크립트의 로컬 중복 구현이 제거됨
- [ ] `orchestrate.sh` 정상 실행 확인 (기존 로직 변경 없음)
