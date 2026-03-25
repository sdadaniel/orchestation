#!/bin/bash
# iTerm 세션 종료 헬퍼
# 현재 세션의 $ITERM_SESSION_ID를 사용하여 해당 패널을 닫음
# write text로 실행된 세션에서만 동작 (command: 방식은 $ITERM_SESSION_ID 미설정)

echo ""
echo "━━━ Session Ended ━━━"
sleep 2

SID="$ITERM_SESSION_ID"
if [ -z "$SID" ]; then
  # fallback: ITERM_SESSION_ID가 없으면 exit으로 쉘 종료
  exit 0
fi

osascript <<EOF
tell application "iTerm"
    repeat with w in windows
        repeat with t in tabs of w
            repeat with s in sessions of t
                if unique ID of s is "$SID" then
                    tell s to write text "exit"
                end if
            end repeat
        end repeat
    end repeat
end tell
EOF
