SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 인자 파싱: --prd N [프롬프트 번호들]
PRD_NUM=1
TARGETS=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prd) PRD_NUM="$2"; shift 2 ;;
    *) TARGETS="$TARGETS $1"; shift ;;
  esac
done
TARGETS=$(echo "$TARGETS" | xargs)

PRD_FILE="$ROOT_DIR/docs/prd/prd${PRD_NUM}.md"
if [ ! -f "$PRD_FILE" ]; then
  echo "docs/prd/prd${PRD_NUM}.md 파일이 없습니다."
  ls "$ROOT_DIR"/docs/prd/*.md 2>/dev/null | sed 's/.*prd\([0-9]*\)\.md/  사용 가능: --prd \1/'
  exit 1
fi

PRD_TITLE=$(head -1 "$PRD_FILE" | sed 's/^#* *//')
echo "📋 PRD: ${PRD_TITLE} (prd${PRD_NUM}.md)"

# 이전 결과 초기화
bash "${SCRIPT_DIR}/clean.sh"

if [ -z "$TARGETS" ]; then
  TARGETS=$(ls "$ROOT_DIR"/docs/prompts/prompt*.md 2>/dev/null | sed 's/.*prompt\([0-9]*\)\.md/\1/' | sort -n | tr '\n' ' ')
  if [ -z "$TARGETS" ]; then
    echo "docs/prompts/prompt*.md 파일이 없습니다."
    exit 1
  fi
fi

FIRST=true
COUNT=0
for i in $TARGETS; do
  if [ ! -f "$ROOT_DIR/docs/prompts/prompt${i}.md" ]; then
    echo "docs/prompts/prompt${i}.md 파일이 없습니다. 건너뜁니다."
    continue
  fi

  DONE_FLAG="$ROOT_DIR/prompt${i}/spec/.done"
  rm -f "$DONE_FLAG"
  CMD="bash '${SCRIPT_DIR}/run.sh' ${i} --prd ${PRD_NUM} && touch '${DONE_FLAG}'"
  if [ "$FIRST" = true ]; then
    # 첫 번째: 수평 분할 후 아래 패널 ID 저장
    BOTTOM_SESSION=$(osascript -e "tell application \"iTerm\"
      tell current window
        tell current session
          set bottomPane to (split horizontally with default profile)
          tell bottomPane
            write text \"$CMD\"
          end tell
          return id of bottomPane
        end tell
      end tell
    end tell")
    FIRST=false
  else
    # 나머지: 아래 패널에서 세로 분할
    BOTTOM_SESSION=$(osascript -e "tell application \"iTerm\"
      tell current window
        repeat with s in sessions
          if id of s is \"${BOTTOM_SESSION}\" then
            tell s
              set newPane to (split vertically with default profile)
              tell newPane
                write text \"$CMD\"
              end tell
              return id of newPane
            end tell
          end if
        end repeat
      end tell
    end tell")
  fi
  COUNT=$((COUNT + 1))
done

# 모든 프롬프트 완료 대기 후 리포트 생성
echo "⏳ ${COUNT}개 프롬프트 완료 대기 중..."
NOTIFIED=""
while true; do
  DONE=0
  for i in $TARGETS; do
    if [ -f "$ROOT_DIR/prompt${i}/spec/.done" ]; then
      DONE=$((DONE + 1))
      if ! echo "$NOTIFIED" | grep -q " ${i} "; then
        COST=$(tail -1 "$ROOT_DIR/prompt${i}/spec/output.jsonl" 2>/dev/null | python3 -c "import sys,json; o=json.load(sys.stdin); print(f'\${o.get(\"total_cost_usd\",0):.4f} | {o.get(\"duration_ms\",0)/1000:.0f}s | {o.get(\"num_turns\",0)}턴')" 2>/dev/null)
        echo "  ✅ prompt${i} 완료 (${DONE}/${COUNT}) — ${COST}"
        NOTIFIED="$NOTIFIED ${i} "
      fi
    fi
  done
  if [ "$DONE" -ge "$COUNT" ]; then
    break
  fi
  sleep 5
done

echo "✅ 모든 프롬프트 완료. 리포트 생성 중..."
bash "${SCRIPT_DIR}/report.sh"
