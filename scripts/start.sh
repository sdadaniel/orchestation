SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ "$#" -gt 0 ]; then
  TARGETS="$@"
else
  N=$(ls "$ROOT_DIR"/docs/prompts/prompt*.md 2>/dev/null | wc -l | tr -d ' ')
  if [ "$N" -eq 0 ]; then
    echo "docs/prompts/prompt*.md 파일이 없습니다."
    exit 1
  fi
  TARGETS=$(seq 1 "$N")
fi

FIRST=true
for i in $TARGETS; do
  if [ ! -f "$ROOT_DIR/docs/prompts/prompt${i}.md" ]; then
    echo "docs/prompts/prompt${i}.md 파일이 없습니다. 건너뜁니다."
    continue
  fi

  CMD="bash '${SCRIPT_DIR}/run.sh' ${i}"
  if [ "$FIRST" = true ]; then
    osascript -e "tell application \"iTerm\"
      activate
      set newWindow to (create window with default profile)
      tell current session of newWindow
        write text \"$CMD\"
      end tell
    end tell"
    FIRST=false
  else
    osascript -e "tell application \"iTerm\"
      tell current window
        tell current session
          set newPane to (split vertically with default profile)
          tell newPane
            write text \"$CMD\"
          end tell
        end tell
      end tell
    end tell"
  fi
done    