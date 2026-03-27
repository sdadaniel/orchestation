---
id: TASK-283
title: "orchestrate.sh API키 읽기 로직 중복 제거"
status: pending
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:  []
---

확인 완료. `orchestrate.sh`의 API key 읽기 블록이 `start_task()`과 `start_review()`에서 동일하게 중복됩니다.

---
id: TASK-283
title: "orchestrate.sh API키 읽기 로직 중복 제거"
status: pending
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - scripts/orchestrate.sh
---
`orchestrate.sh`의 `start_task()` (394-399행)과 `start_review()` (436-441행)에 동일한 API key 읽기 블록이 복사-붙여넣기로 중복되어 있다.

```bash
local _api_key=""
if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
  _api_key=$(jq -r '.claudeApiKey // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
elif [ -f "$CONFIG_FILE" ]; then
  _api_key=$(awk -F'"' '/"claudeApiKey"/{print $4; exit}' "$CONFIG_FILE" 2>/dev/null || echo "")
fi
```

`read_api_key()` 헬퍼 함수를 파일 상단에 정의하고, 두 함수에서 호출하도록 변경한다.

## Completion Criteria
- `read_api_key()` 헬퍼 함수가 `orchestrate.sh` 상단에 정의됨
- `start_task()`과 `start_review()`가 해당 헬퍼를 호출
- `bash -n scripts/orchestrate.sh` 문법 검사 통과
- 기존 동작 변경 없음

## Completion Criteria


