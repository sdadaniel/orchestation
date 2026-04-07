#!/bin/bash
# signal.sh - Atomic signal file operations (race-condition safe)
# Uses atomic rename for creation and mkdir-based locking for consumption.
# Compatible with both Linux and macOS (no flock dependency).

# ── Portable lock primitives (mkdir is atomic on all POSIX systems) ──

_signal_lock() {
  local lockdir="$1"
  local max_wait=30  # seconds
  local waited=0
  while ! mkdir "$lockdir" 2>/dev/null; do
    sleep 0.1
    waited=$((waited + 1))
    if [ "$waited" -ge "$((max_wait * 10))" ]; then
      echo "signal: lock timeout on $lockdir" >&2
      return 1
    fi
  done
}

_signal_unlock() {
  rmdir "$1" 2>/dev/null || true
}

# ── Public API ───────────────────────────────────────────────

# Create a signal file atomically using temp + mv (atomic rename)
# Usage: signal_create <signal_dir> <task_id> <suffix>
#   suffix: "done" or "failed"
signal_create() {
  local signal_dir="$1"
  local task_id="$2"
  local suffix="$3"

  if [ -z "$signal_dir" ] || [ -z "$task_id" ] || [ -z "$suffix" ]; then
    echo "signal_create: missing arguments" >&2
    return 1
  fi

  local target="${signal_dir}/${task_id}-${suffix}"
  local tmp="${target}.tmp.$$"

  # Write to temp file, then atomic rename (mv on same filesystem is atomic)
  echo "$$" > "$tmp"
  mv -f "$tmp" "$target"
}

# Check if a signal file exists for a task
# Returns 0 if any signal exists, 1 otherwise
# Sets SIGNAL_TYPE to the signal suffix found
# Supports: done, failed, task-done, task-failed, review-approved, review-rejected, stopped
signal_check() {
  local signal_dir="$1"
  local task_id="$2"

  local suffix
  for suffix in task-done task-failed task-rejected review-approved review-rejected done failed stopped; do
    if [ -f "${signal_dir}/${task_id}-${suffix}" ]; then
      SIGNAL_TYPE="$suffix"
      return 0
    fi
  done
  return 1
}

# Consume (delete) a signal file under lock to prevent double-processing
# Usage: signal_consume <signal_dir> <task_id>
# Returns 0 and sets SIGNAL_TYPE if consumed, 1 if no signal found
signal_consume() {
  local signal_dir="$1"
  local task_id="$2"
  local lockdir="${signal_dir}/.lock.d"

  SIGNAL_TYPE=""

  _signal_lock "$lockdir" || return 1

  local result="none"
  local suffix
  for suffix in task-done task-failed task-rejected review-approved review-rejected done failed stopped; do
    if [ -f "${signal_dir}/${task_id}-${suffix}" ]; then
      rm -f "${signal_dir}/${task_id}-${suffix}"
      result="$suffix"
      break
    fi
  done

  _signal_unlock "$lockdir"

  if [ "$result" != "none" ]; then
    SIGNAL_TYPE="$result"
    return 0
  fi
  return 1
}

# Wait for all tasks in a batch to have signals
# Usage: signal_wait_all <signal_dir> <task_id1> [task_id2 ...]
signal_wait_all() {
  local signal_dir="$1"
  shift
  local task_ids=("$@")

  while true; do
    local all_done=true
    for task_id in "${task_ids[@]}"; do
      if ! signal_check "$signal_dir" "$task_id"; then
        all_done=false
        break
      fi
    done
    if [ "$all_done" = true ]; then
      break
    fi
    sleep 2
  done
}
