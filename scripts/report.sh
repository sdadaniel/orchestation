#!/bin/bash
# 각 prompt의 output.jsonl에서 결과를 추출하여 report/data.json 생성

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="$ROOT_DIR/report/report_${TIMESTAMP}"
mkdir -p "$REPORT_DIR"

# index.html 복사
cp "$ROOT_DIR/report/_template.html" "$REPORT_DIR/index.html"

# PRD 내용 읽기 (실제 실행에 사용된 PRD)
PRD_NUM="1"
for dir in "$ROOT_DIR"/prompt*/; do
  if [ -f "$dir/spec/_prd_num" ]; then
    PRD_NUM=$(cat "$dir/spec/_prd_num")
    break
  fi
done
PRD_FILE="$ROOT_DIR/docs/prd/prd${PRD_NUM}.md"
PRD_CONTENT='""'
if [ -f "$PRD_FILE" ]; then
  PRD_CONTENT=$(python3 -c "
import json
with open('$PRD_FILE') as f:
    print(json.dumps(f.read()))
" 2>/dev/null)
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

echo "]," >> "$REPORT_DIR/data.json"

# AI 분석 생성
echo "AI 분석 생성 중..."
AI_REPORT=$(cat "$REPORT_DIR/data.json" | python3 -c "
import sys, json
raw = sys.stdin.read()
# 닫는 괄호 임시 추가해서 파싱
data = json.loads(raw + '\"ai_report\": \"\"}')
prompts = data.get('prompts', [])

summary = []
for p in prompts:
    summary.append(f\"{p['name']} ({p.get('title','')}):\")
    summary.append(f\"  cost=\${p['cost_usd']:.4f}, time={p['duration_sec']}s, turns={p['num_turns']}, files={p['file_count']}, loc={p['line_count']}\")
    summary.append(f\"  cache_hit={p.get('cache_read_tokens',0)}, cache_create={p.get('cache_creation_tokens',0)}\")
    summary.append(f\"  output_tokens={p['output_tokens']}\")
    summary.append('')

print('\n'.join(summary))
" 2>/dev/null)

AI_ANALYSIS=$(echo "$AI_REPORT" | claude --print --model claude-sonnet-4-6 --system-prompt "당신은 프롬프트 성능 분석가입니다. 아래는 동일한 PRD를 서로 다른 프롬프트로 실행한 결과입니다. 다음 관점에서 분석해주세요:

1. 종합 순위 (가성비 기준)
2. 각 프롬프트별 한줄 평가
3. 비용 효율성 분석 (캐시 히트, 턴 수 관점)
4. 핵심 인사이트 (놀라운 발견, 반직관적 결과)
5. 다음 테스트를 위한 제안

마크다운 형식으로, 한국어로, 간결하게 작성하세요." 2>/dev/null)

# AI 분석을 JSON으로 인코딩
AI_JSON=$(python3 -c "
import json, sys
text = sys.stdin.read()
print(json.dumps(text))
" <<< "$AI_ANALYSIS")

echo "\"ai_report\": ${AI_JSON}," >> "$REPORT_DIR/data.json"

# 코드 리뷰 생성
echo "코드 리뷰 생성 중..."
CODE_SUMMARY=$(python3 -c "
import os, json

root = '$ROOT_DIR'
results = []
for d in sorted(os.listdir(root)):
    if not d.startswith('prompt'):
        continue
    src = os.path.join(root, d, 'src')
    if not os.path.isdir(src):
        results.append(f'### {d}\n파일 없음 (코드 미생성)\n')
        continue

    files_content = []
    for r, dirs, files in os.walk(src):
        dirs[:] = [x for x in dirs if x != 'node_modules']
        for f in files:
            fp = os.path.join(r, f)
            rel = os.path.relpath(fp, src)
            try:
                with open(fp) as fh:
                    content = fh.read()
                if len(content) > 3000:
                    content = content[:3000] + '\n... (truncated)'
                files_content.append(f'--- {rel} ---\n{content}')
            except:
                pass

    results.append(f'### {d}\n' + '\n'.join(files_content))

print('\n\n'.join(results))
" 2>/dev/null)

PRD_TEXT=$(cat "$PRD_FILE" 2>/dev/null)

CODE_REVIEW=$(echo "$CODE_SUMMARY" | claude --print --model claude-sonnet-4-6 --system-prompt "당신은 시니어 코드 리뷰어입니다. 아래는 동일한 PRD를 서로 다른 프롬프트로 구현한 코드입니다.

PRD:
${PRD_TEXT}

각 prompt에 대해 아래 항목을 평가하세요. 점수는 10점 만점.

## 평가 항목
1. **실행 가능성** (10점) - 서버가 뜨고 정상 동작하는가
2. **PRD 충족도** (10점) - 요구된 기능이 모두 구현되었는가
3. **UI 완성도** (10점) - 웹 UI가 있고 CSS가 적용되어 사용 가능한가
4. **코드 구조** (10점) - 파일 분리, 모듈화, 가독성
5. **에러 처리** (10점) - 예외 상황 대응, 입력 검증
6. **보안** (10점) - 인젝션 방지, rate limit 등

## 출력 형식

각 prompt별로:
- 항목별 점수와 한줄 사유
- 총점 (/60)
- 한줄 총평

마지막에 종합 순위표를 작성하세요.

마크다운, 한국어, 간결하게." 2>/dev/null)

CODE_REVIEW_JSON=$(python3 -c "
import json, sys
text = sys.stdin.read()
print(json.dumps(text))
" <<< "$CODE_REVIEW")

echo "\"code_review\": ${CODE_REVIEW_JSON}}" >> "$REPORT_DIR/data.json"

# 리포트 목록 JSON 생성 (PRD별 그룹핑)
python3 -c "
import os, json, glob, hashlib

report_root = '$ROOT_DIR/report'
dirs = sorted(glob.glob(os.path.join(report_root, 'report_*')), reverse=True)

prd_groups = {}
for d in dirs:
    name = os.path.basename(d)
    data_file = os.path.join(d, 'data.json')
    prompts = 0
    cost = 0
    prd_text = ''
    prd_title = ''
    if os.path.exists(data_file):
        try:
            with open(data_file) as f:
                data = json.load(f)
            ps = data.get('prompts', [])
            prompts = len(ps)
            cost = sum(p.get('cost_usd', 0) for p in ps)
            prd_text = data.get('prd', '')
            # PRD 첫 줄에서 제목 추출
            for line in prd_text.split('\n'):
                line = line.strip().lstrip('#').strip()
                if line:
                    prd_title = line
                    break
        except:
            pass

    prd_key = prd_title if prd_title else 'unknown'

    if prd_key not in prd_groups:
        prd_groups[prd_key] = {
            'title': prd_title or 'Unknown PRD',
            'prd_preview': prd_text[:200] if prd_text else '',
            'reports': []
        }
    prd_groups[prd_key]['reports'].append({
        'dir': name,
        'prompts': prompts,
        'cost': round(cost, 4)
    })

with open(os.path.join(report_root, 'reports.json'), 'w') as f:
    json.dump(list(prd_groups.values()), f)
"

echo "report/report_${TIMESTAMP}/ 생성 완료"
