#!/bin/bash
# 각 prompt의 output.jsonl에서 결과를 추출하여 report/data.json 생성

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="$ROOT_DIR/report/report_${TIMESTAMP}"
mkdir -p "$REPORT_DIR"

# index.html 복사
cp "$ROOT_DIR/report/_template.html" "$REPORT_DIR/index.html"

# PRD 내용 읽기
PRD_CONTENT=""
if [ -f "$ROOT_DIR/docs/prd.md" ]; then
  PRD_CONTENT=$(python3 -c "
import json
with open('$ROOT_DIR/docs/prd.md') as f:
    print(json.dumps(f.read()))
" 2>/dev/null)
else
  PRD_CONTENT='""'
fi

echo "{\"prd\": ${PRD_CONTENT}, \"prompts\": [" > "$REPORT_DIR/data.json"

FIRST=true
for dir in "$ROOT_DIR"/prompt*/; do
  [ ! -d "$dir" ] && continue
  i=$(basename "$dir" | sed 's/prompt//')
  JSONL="$dir/spec/output.jsonl"
  [ ! -f "$JSONL" ] && continue

  PROMPT_NAME="prompt${i}"
  PROMPT_FILE="$ROOT_DIR/docs/prompts/prompt${i}.md"
  PROMPT_TITLE=""
  if [ -f "$PROMPT_FILE" ]; then
    PROMPT_TITLE=$(head -1 "$PROMPT_FILE" | sed 's/^#* *//')
  fi

  # 마지막 라인에서 결과 추출
  LAST_LINE=$(tail -1 "$JSONL")

  # python으로 파싱
  DATA=$(echo "$LAST_LINE" | python3 -c "
import sys, json
obj = json.load(sys.stdin)
usage = obj.get('modelUsage', {})
model = list(usage.values())[0] if usage else {}
src_dir = '${dir}src'

import os, subprocess
file_count = 0
line_count = 0
if os.path.isdir(src_dir):
    for root, dirs, files in os.walk(src_dir):
        dirs[:] = [d for d in dirs if d != 'node_modules']
        for f in files:
            fp = os.path.join(root, f)
            file_count += 1
            try:
                with open(fp) as fh:
                    line_count += sum(1 for _ in fh)
            except:
                pass

prompt_content = ''
try:
    with open('${PROMPT_FILE}') as pf:
        prompt_content = pf.read()
except:
    pass

print(json.dumps({
    'name': '${PROMPT_NAME}',
    'title': '${PROMPT_TITLE}',
    'prompt_content': prompt_content,
    'duration_sec': round(obj.get('duration_ms', 0) / 1000, 1),
    'num_turns': obj.get('num_turns', 0),
    'cost_usd': round(obj.get('total_cost_usd', 0), 4),
    'input_tokens': model.get('inputTokens', 0),
    'output_tokens': model.get('outputTokens', 0),
    'cache_read_tokens': model.get('cacheReadInputTokens', 0),
    'cache_creation_tokens': model.get('cacheCreationInputTokens', 0),
    'result': obj.get('result', ''),
    'file_count': file_count,
    'line_count': line_count,
    'stop_reason': obj.get('stop_reason', ''),
    'permission_denials': len(obj.get('permission_denials', []))
}))
" 2>/dev/null)

  if [ -n "$DATA" ]; then
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      echo "," >> "$REPORT_DIR/data.json"
    fi
    echo "$DATA" >> "$REPORT_DIR/data.json"
  fi
done

echo "]}" >> "$REPORT_DIR/data.json"

echo "report/report_${TIMESTAMP}/ 생성 완료"
