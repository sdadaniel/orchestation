#!/bin/sh
# Fix execute permission on node-pty spawn-helper binaries
# Required because npm/yarn may strip +x during install
for f in node_modules/node-pty/prebuilds/*/spawn-helper; do
  [ -f "$f" ] && chmod +x "$f"
done
