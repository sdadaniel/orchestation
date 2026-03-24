#!/bin/bash
set -euo pipefail

# Usage: ./scripts/run-pipeline.sh
# docs/task/ 의 모든 TASK를 의존 관계에 따라 순차/병렬 자동 실행

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_DIR="$REPO_ROOT/docs/task"
RUN_WORKER="$REPO_ROOT/scripts/run-worker.sh"
PIDS=()
FAILED=0

echo "🚀 Pipeline 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# TASK 파일에서 ID 추출
get_task_ids() {
  find "$TASK_DIR" -name "TASK-*.md" | sort | while read -r f; do
    grep '^id:' "$f" | sed 's/id: *//'
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

# 배치 단위로 실행 (같은 레벨의 TASK를 병렬 실행)
run_batch() {
  local batch=("$@")
  PIDS=()

  echo ""
  echo "▶ 병렬 실행: ${batch[*]}"
  echo ""

  for task_id in "${batch[@]}"; do
    echo "  🔧 ${task_id} 시작..."
    "$RUN_WORKER" "$task_id" &
    PIDS+=($!)
  done

  # 모든 병렬 작업 대기
  for i in "${!PIDS[@]}"; do
    if wait "${PIDS[$i]}"; then
      echo "  ✅ ${batch[$i]} 완료"
      # status를 done으로 업데이트
      local task_file
      task_file=$(find "$TASK_DIR" -name "${batch[$i]}-*.md" | head -1)
      if [ -n "$task_file" ]; then
        sed -i '' "s/^status: .*/status: done/" "$task_file"
      fi

      # 브랜치를 main에 머지
      local branch
      branch=$(get_branch "${batch[$i]}")
      if [ -n "$branch" ]; then
        local wt_path
        wt_path=$(get_worktree "${batch[$i]}")

        # worktree 제거 (머지 전에 해야 브랜치 삭제 가능)
        if [ -d "$wt_path" ]; then
          git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || true
        fi

        # main에 머지 (새 커밋이 있는 경우만)
        if git -C "$REPO_ROOT" log --oneline "main..$branch" 2>/dev/null | grep -q .; then
          echo "  🔀 ${batch[$i]}: $branch → main 머지"
          git -C "$REPO_ROOT" merge "$branch" --no-ff --no-edit
        fi

        # 머지 완료 후 브랜치 삭제
        git -C "$REPO_ROOT" branch -d "$branch" 2>/dev/null || true
      fi

      # 태스크 상태 변경을 커밋
      if [ -n "$task_file" ]; then
        git -C "$REPO_ROOT" add "$task_file"
        git -C "$REPO_ROOT" commit -m "chore(${batch[$i]}): status → done"
      fi
    else
      echo "  ❌ ${batch[$i]} 실패"
      FAILED=1
    fi
  done

  if [ "$FAILED" -eq 1 ]; then
    echo ""
    echo "❌ 실패한 TASK가 있어 Pipeline을 중단합니다."
    exit 1
  fi
}

# 메인 루프: 실행 가능한 TASK를 배치로 모아서 실행
while true; do
  BATCH=()

  # 실행 가능한 TASK 수집 (backlog + 의존 충족)
  while IFS= read -r task_id; do
    status=$(get_status "$task_id")
    if [ "$status" != "backlog" ]; then
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

    # 남은 backlog 확인
    REMAINING=0
    while IFS= read -r task_id; do
      status=$(get_status "$task_id")
      if [ "$status" == "backlog" ]; then
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
