#!/bin/bash
# iTerm 세션 종료 헬퍼
# 현재 세션의 $ITERM_SESSION_ID를 사용하여 해당 패널을 닫음

sleep 1

SID="$ITERM_SESSION_ID"
if [ -z "$SID" ]; then
  exit 0
fi

osascript <<EOF
tell application "iTerm"
    repeat with w in windows
        repeat with t in tabs of w
            repeat with s in sessions of t
                if unique ID of s is "$SID" then
                    close s
                end if
            end repeat
        end repeat
    end repeat
end tell
EOF
