# auto-improve.sh bash 3.x 호환성 위반 분석

## 요약

`scripts/auto-improve.sh` 398행에서 `declare -A` (associative array)를 사용하고 있으며, 이는 macOS 기본 bash 3.x에서 지원되지 않는 문법이다.

## 위치

| 파일 | 라인 | 코드 |
|------|------|------|
| `scripts/auto-improve.sh` | 398 | `declare -A EVAL_RESULTS_MAP=()` |

## 문제

- CLAUDE.md 규칙: "macOS bash 3.x — `declare -A`, `mapfile`, `readarray` 사용 금지"
- `declare -A`는 bash 4.0+에서만 지원되는 associative array 선언
- macOS 기본 `/bin/bash`는 3.2.x이므로 런타임 에러 발생 가능

## 권장 수정

`declare -A` 대신 인덱스 기반 배열 또는 키=값 문자열 배열로 대체:

```bash
# Before (bash 4+ only)
declare -A EVAL_RESULTS_MAP=()
EVAL_RESULTS_MAP[${ACCEPTED_INDICES[$_ai]}]="${EVAL_RESULTS[$_ai]}"

# After (bash 3.x compatible) — 인덱스 배열로 대체
EVAL_RESULTS_MAP=()
EVAL_RESULTS_MAP[${ACCEPTED_INDICES[$_ai]}]="${EVAL_RESULTS[$_ai]}"
```

주의: 일반 배열의 인덱스 접근(`arr[n]`)은 bash 3.x에서도 동작하며, 키가 정수인 경우 associative array 없이 해결 가능.
