#!/bin/bash
set -euo pipefail

# Usage: ./scripts/run-pipeline.sh
# docs/task/ 의 모든 TASK를 의존 관계에 따라 순차/병렬 자동 실행

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$REPO_ROOT/scripts/lib/sed-inplace.sh"
TASK_DIR="$REPO_ROOT/docs/task"
RUN_WORKER="$REPO_ROOT/scripts/run-worker.sh"
MAX_PARALLEL="${MAX_PARALLEL:-3}"
PIDS=()
FAILED=0

echo "🚀 Pipeline 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# TASK 파일에서 ID 추출
get_task_ids() {
  find "$TASK_DIR" -name "TASK-*.md" | sort | while read -r f; do
    grep '^id:' "$f" | sed 's/id: *//' || true
  done
}

# 특정 TASK의 depends_on 목록 가져오기
get_depends_on() {
  local task_id="$1"
  local task_file
  task_file=$(find "$TASK_DIR" -name "${task_id}-*.md" | head -1)
  if [ -z "$task_file" ]; then return; fi

  awk '
    /^depends_on:/ { in_deps=1; next }
    in_deps && /^ +- / { gsub(/^ +- /, ""); print; next }
    in_deps && /^[^ ]/ { in_deps=0 }
  ' "$task_file"
}

# 특정 TASK의 branch 가져오기
get_branch() {
  local task_id="$1"
  local task_file
  task_file=$(find "$TASK_DIR" -name "${task_id}-*.md" | head -1)
  if [ -z "$task_file" ]; then return; fi
  grep '^branch:' "$task_file" | sed 's/branch: *//'
}

# 특정 TASK의 worktree 경로 가져오기
get_worktree() {
  local task_id="$1"
  local task_file
  task_file=$(find "$TASK_DIR" -name "${task_id}-*.md" | head -1)
  if [ -z "$task_file" ]; then return; fi
  local rel
  rel=$(grep '^worktree:' "$task_file" | sed 's/worktree: *//')
  echo "$REPO_ROOT/$rel"
}

# 특정 TASK의 status 가져오기
get_status() {
  local task_id="$1"
  local task_file
  task_file=$(find "$TASK_DIR" -name "${task_id}-*.md" | head -1)
  if [ -z "$task_file" ]; then echo "unknown"; return; fi
  grep '^status:' "$task_file" | sed 's/status: *//'
}

# 모든 의존 TASK가 done인지 확인
deps_satisfied() {
  local task_id="$1"
  local deps
  deps=$(get_depends_on "$task_id")

  if [ -z "$deps" ]; then
    return 0  # 의존 없으면 바로 실행 가능
  fi

  while IFS= read -r dep; do
    local dep_status
    dep_status=$(get_status "$dep")
    if [ "$dep_status" != "done" ]; then
      return 1
    fi
  done <<< "$deps"
  return 0
}

# 배치 단위로 실행 (같은 레벨의 TASK를 MAX_PARALLEL 제한으로 병렬 실행)
run_batch() {
  local batch=("$@")
  local total=${#batch[@]}

  echo ""
  echo "▶ 병렬 실행: ${batch[*]} (MAX_PARALLEL=${MAX_PARALLEL})"
  echo ""

  local offset=0
  while [ "$offset" -lt "$total" ]; do
    # 현재 청크 추출
    local chunk=("${batch[@]:$offset:$MAX_PARALLEL}")
    offset=$((offset + MAX_PARALLEL))
    PIDS=()

    if [ "$total" -gt "$MAX_PARALLEL" ]; then
      echo "  📦 청크 실행: ${chunk[*]} (${#chunk[@]}/${total})"
    fi

    for task_id in "${chunk[@]}"; do
      echo "  🔧 ${task_id} 시작..."
      "$RUN_WORKER" "$task_id" &
      PIDS+=($!)
    done

    # 청크 내 모든 병렬 작업 대기
    for i in "${!PIDS[@]}"; do
      if wait "${PIDS[$i]}"; then
        echo "  ✅ ${chunk[$i]} 완료"
        local task_file
        task_file=$(find "$TASK_DIR" -name "${chunk[$i]}-*.md" | head -1)
        if [ -n "$task_file" ]; then
          sed_inplace "s/^status: .*/status: done/" "$task_file"
        fi

        local branch
        branch=$(get_branch "${chunk[$i]}")
        if [ -n "$branch" ]; then
          local wt_path
          wt_path=$(get_worktree "${chunk[$i]}")

          if [ -d "$wt_path" ]; then
            git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || true
          fi

          if git -C "$REPO_ROOT" log --oneline "main..$branch" 2>/dev/null | grep -q .; then
            echo "  🔀 ${chunk[$i]}: $branch → main 머지"
            git -C "$REPO_ROOT" merge "$branch" --no-ff --no-edit
          fi

          git -C "$REPO_ROOT" branch -d "$branch" 2>/dev/null || true
        fi

        if [ -n "$task_file" ]; then
          git -C "$REPO_ROOT" add "$task_file"
          git -C "$REPO_ROOT" commit -m "chore(${chunk[$i]}): status → done"
        fi
      else
        echo "  ❌ ${chunk[$i]} 실패"
        FAILED=1
      fi
    done

    if [ "$FAILED" -eq 1 ]; then
      echo ""
      echo "❌ 실패한 TASK가 있어 Pipeline을 중단합니다."
      exit 1
    fi
  done  # end chunk loop
}

# 메인 루프: 실행 가능한 TASK를 배치로 모아서 실행
while true; do
  BATCH=()

  # 실행 가능한 TASK 수집 (pending + 의존 충족)
  while IFS= read -r task_id; do
    status=$(get_status "$task_id")
    if [ "$status" != "pending" ]; then
      continue
    fi
    if deps_satisfied "$task_id"; then
      BATCH+=("$task_id")
    fi
  done <<< "$(get_task_ids)"

  # 더 이상 실행할 TASK가 없으면 종료
  if [ ${#BATCH[@]} -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Pipeline 완료!"

    # 남은 pending 확인
    REMAINING=0
    while IFS= read -r task_id; do
      status=$(get_status "$task_id")
      if [ "$status" == "pending" ]; then
        REMAINING=$((REMAINING + 1))
      fi
    done <<< "$(get_task_ids)"

    if [ "$REMAINING" -gt 0 ]; then
      echo "⚠️  의존 관계가 충족되지 않아 실행되지 못한 TASK: ${REMAINING}개"
    fi
    break
  fi

  run_batch "${BATCH[@]}"
done
