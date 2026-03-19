#!/bin/bash
set -euo pipefail

# Usage: ./scripts/run-worker.sh TASK-XXX SIGNAL_DIR MAX_RETRY
# run-task.sh → run-review.sh → 승인 시 done 시그널 / 실패 시 fail 시그널

TASK_ID="${1:?Usage: ./scripts/run-worker.sh TASK-XXX SIGNAL_DIR MAX_RETRY}"
SIGNAL_DIR="${2:?Missing SIGNAL_DIR}"
MAX_RETRY="${3:-2}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for i in $(seq 0 "$MAX_RETRY"); do
  # 작업 실행
  if bash "$REPO_ROOT/scripts/run-task.sh" "$TASK_ID"; then
    # 리뷰 실행
    if bash "$REPO_ROOT/scripts/run-review.sh" "$TASK_ID"; then
      touch "${SIGNAL_DIR}/${TASK_ID}-done"
      exit 0
    fi
  fi

  # 마지막 시도였으면 실패
  if [ "$i" -eq "$MAX_RETRY" ]; then
    touch "${SIGNAL_DIR}/${TASK_ID}-failed"
    exit 1
  fi

  echo ""
  echo "[retry] 리뷰 실패, 재작업 시도... ($((i + 1))/${MAX_RETRY})"
  echo ""
done
