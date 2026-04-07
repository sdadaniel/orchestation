#!/bin/bash
# iterm-run.sh — iTerm2 새 탭에서 명령어 실행
# Usage: iterm-run.sh <tab-title> <command...>
# Exit: 0=성공 (탭 생성), 1=iTerm2 미실행

TAB_TITLE="${1:?Usage: iterm-run.sh <tab-title> <command...>}"
shift
CMD="$*"

if [ -z "$CMD" ]; then
  echo "❌ 실행할 명령어가 없습니다" >&2
  exit 1
fi

# iTerm2 실행 여부 확인
if ! osascript -e 'tell application "System Events" to (name of processes) contains "iTerm2"' 2>/dev/null | grep -q true; then
  echo "❌ iTerm2가 실행 중이지 않습니다" >&2
  exit 1
fi

osascript <<APPLESCRIPT
tell application "iTerm"
  activate
  tell current window
    set newTab to (create tab with default profile)
    tell current session of newTab
      set name to "${TAB_TITLE}"
      write text "${CMD}"
    end tell
  end tell
end tell
APPLESCRIPT
