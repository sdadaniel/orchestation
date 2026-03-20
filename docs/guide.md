# 실행 가이드 (사용자용)

## 측정 항목

| 항목                        | 소스                   |
| --------------------------- | ---------------------- |
| input_tokens                | `--output-format json` |
| output_tokens               | `--output-format json` |
| cache_creation / cache_read | `--output-format json` |
| cost_usd                    | `--output-format json` |
| duration (wall-clock)       | `time` 명령어          |
| num_turns                   | `--output-format json` |

## 실행 방법

각 프롬프트별로 별도 터미널에서 실행. 작업 디렉토리를 분리하여 충돌 방지.

```bash
# 사전 준비 (최초 1회)
mkdir -p test/prompts/{prd1,prd2}
```

```bash
# 터미널 1 — prd1
time claude -p "$(cat test/prompts/prd1.md)" \
  --output-format json \
  > src/prompts/prd1/result.json 2>test/prompts/prd1/stderr.log

# 터미널 2 — prd2
time claude -p "$(cat test/prompts/prd2.md)" \
  --output-format json \
  > test/prompts/prd2/result.json 2>test/prompts/prd2/stderr.log
```

## 결과 확인

```bash
# 토큰 사용량 확인
cat test/prompts/prd1/result.json | jq '.result.usage'
cat test/prompts/prd2/result.json | jq '.result.usage'
```
