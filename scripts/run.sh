#!/bin/bash
# 사용법: bash run.sh <번호> [모델] [--prd N]
# 예: bash run.sh 3
# 예: bash run.sh 3 sonnet
# 예: bash run.sh 3 --prd 2

if [ -z "$1" ]; then
  echo "사용법: bash run.sh <번호> [모델] [--prd N]"
  echo "모델: sonnet(기본), opus, haiku"
  exit 1
fi

i=$1; shift
MODEL="sonnet"
PRD_NUM=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prd) PRD_NUM="$2"; shift 2 ;;
    *) MODEL="$1"; shift ;;
  esac
done

MODEL_ARG=""
case "$MODEL" in
  sonnet) MODEL_ARG="--model claude-sonnet-4-6" ;;
  opus)   MODEL_ARG="--model claude-opus-4-6" ;;
  haiku)  MODEL_ARG="--model claude-haiku-4-5-20251001" ;;
  *)      MODEL_ARG="--model $MODEL" ;;
esac
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PRD_FILE="$ROOT_DIR/docs/prd/prd${PRD_NUM}.md"

if [ ! -f "$PRD_FILE" ]; then
  echo "docs/prd/prd${PRD_NUM}.md 파일이 없습니다."
  exit 1
fi

if [ ! -f "$ROOT_DIR/docs/prompts/prompt${i}.md" ]; then
  echo "docs/prompts/prompt${i}.md 파일이 없습니다."
  exit 1
fi

WORK_DIR="$ROOT_DIR/prompt${i}"
RULE="[절대 규칙]
1. 현재 작업 디렉토리는 ${WORK_DIR} 이다. 모든 파일 경로는 반드시 이 경로를 기준으로 사용하라. 다른 경로에 파일을 생성하지 마라.
2. 현재 작업 디렉토리 외부의 파일을 읽거나 참조하지 마라. 특히 ../prompt*, ../docs/prompts/ 등 다른 프롬프트나 다른 에이전트의 결과물을 절대 참고하지 마라.
3. 모든 코드 파일은 반드시 ${WORK_DIR}/src/ 디렉토리 안에 생성하라. package.json, 설정 파일, 데이터 파일 등 프로젝트의 모든 파일은 예외 없이 src/ 하위에 위치해야 한다. src/ 외부에 파일을 생성하지 마라."

mkdir -p "$ROOT_DIR/prompt${i}/src" "$ROOT_DIR/prompt${i}/spec"

# 사용한 PRD 번호 기록
echo "$PRD_NUM" > "$ROOT_DIR/prompt${i}/spec/_prd_num"

PROMPT_FILE="$ROOT_DIR/prompt${i}/spec/_prompt.txt"
{
  cat "$ROOT_DIR/docs/prompts/prompt${i}.md"
  echo ""
  echo "$RULE"
} > "$PROMPT_FILE"

cd "$ROOT_DIR/prompt${i}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  prompt${i} 실행 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat "$PRD_FILE" | claude $MODEL_ARG --output-format stream-json --verbose --dangerously-skip-permissions \
  --system-prompt "$(cat spec/_prompt.txt)" \
  | tee spec/output.jsonl \
  | python3 -u -c "
import sys, json

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        obj = json.loads(line)
        t = obj.get('type', '')

        if t == 'assistant':
            for block in obj.get('message', {}).get('content', []):
                if block.get('type') == 'text':
                    text = block['text']
                    if len(text) > 200:
                        text = text[:200] + '...'
                    print(f'  💬 {text}')
                elif block.get('type') == 'tool_use':
                    name = block.get('name', '')
                    inp = block.get('input', {})
                    detail = ''
                    if 'command' in inp:
                        detail = inp['command'][:80]
                    elif 'file_path' in inp:
                        detail = inp['file_path'].split('/')[-1]
                    elif 'prompt' in inp:
                        detail = inp['prompt'][:60] + '...'
                    print(f'  🔧 {name}: {detail}')

        elif t == 'result':
            cost = obj.get('total_cost_usd', 0)
            dur = obj.get('duration_ms', 0) / 1000
            turns = obj.get('num_turns', 0)
            out_tok = obj.get('usage', {}).get('output_tokens', 0)
            print()
            print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            print(f'  ✅ 완료!')
            print(f'  ⏱  {dur:.1f}초 | 💰 \${cost:.4f} | 🔄 {turns}턴 | 📝 {out_tok} tokens')
            print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    except json.JSONDecodeError:
        pass
    sys.stdout.flush()
"
