---
id: TASK-288
title: "orchestrate.sh output_dir 폴백 패턴 중복 제거"
status: pending
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:  []
---

Confirmed. The `output_dir` fallback pattern is duplicated at lines 535-540 and 582-587.

---
id: TASK-288
title: "orchestrate.sh output_dir 폴백 패턴 중복 제거"
status: pending
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - scripts/orchestrate.sh
---
`process_signals_for_task()` 함수 내에서 동일한 output_dir 폴백 로직이 535-540행과 582-587행에 중복되어 있다.

```bash
local output_dir
if [ -d "$REPO_ROOT/.orchestration/output" ]; then
  output_dir="$REPO_ROOT/.orchestration/output"
else
  output_dir="$REPO_ROOT/output"
fi
```

`get_output_dir()` 헬퍼 함수를 파일 상단에 정의하고, 두 위치에서 호출하도록 변경한다.

## Completion Criteria
- `get_output_dir()` 헬퍼 함수가 `orchestrate.sh` 상단에 정의됨
- `process_signals_for_task()` 내 두 곳이 해당 헬퍼를 호출
- `bash -n scripts/orchestrate.sh` 문법 검사 통과
- 기존 동작 변경 없음

## Completion Criteria


