#!/bin/bash
set -euo pipefail

# Usage: ./scripts/cleanup-stuck.sh [--dry-run]
# in_progress 상태지만 실제로는 끝난 태스크를 로그 기반으로 정리
#   - 리뷰 승인됨 ✅ → done (머지 + worktree 정리)
#   - retry 상한 초과 → failed (피드백 기록 + worktree 정리)
#   - 로그 없거나 중간에 끊김 → stopped (worktree 유지, 재시작 가능)

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$REPO_ROOT/scripts/lib/sed-inplace.sh"

# ── BASE_BRANCH 결정 (환경변수 > config.json > 기본값 main) ──
CONFIG_FILE="$REPO_ROOT/config.json"
if [ -z "${BASE_BRANCH:-}" ]; then
  if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    BASE_BRANCH=$(jq -r '.baseBranch // "main"' "$CONFIG_FILE" 2>/dev/null || echo "main")
  elif [ -f "$CONFIG_FILE" ]; then
    BASE_BRANCH=$(awk -F'"' '/"baseBranch"/{print $4; exit}' "$CONFIG_FILE" 2>/dev/null || echo "main")
  else
    BASE_BRANCH="main"
  fi
fi
[ -z "${BASE_BRANCH:-}" ] && BASE_BRANCH="main"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "🔍 dry-run 모드: 변경 없이 결과만 표시"
  echo ""
fi

if [ -d "$REPO_ROOT/.orchestration/tasks" ]; then
  TASK_DIR="$REPO_ROOT/.orchestration/tasks"
else
  TASK_DIR="$REPO_ROOT/docs/task"
fi
if [ -d "$REPO_ROOT/.orchestration/output/logs" ]; then
  LOG_DIR="$REPO_ROOT/.orchestration/output/logs"
else
  LOG_DIR="$REPO_ROOT/output/logs"
fi
if [ -d "$REPO_ROOT/.orchestration/output" ]; then
  OUTPUT_DIR="$REPO_ROOT/.orchestration/output"
else
  OUTPUT_DIR="$REPO_ROOT/output"
fi

get_field() {
  awk -v key="$2" '
    NR==1 && /^---$/ { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm && $0 ~ "^"key":" { sub("^"key":[ ]*", ""); print; exit }
  ' "$1"
}

# in_progress 태스크 수집
stuck_files=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  status=$(get_field "$f" "status")
  if [[ "$status" == "in_progress" ]]; then
    stuck_files+=("$f")
  fi
done < <(find "$TASK_DIR" -maxdepth 1 -name "TASK-*.md" 2>/dev/null)

if [ ${#stuck_files[@]} -eq 0 ]; then
  echo "✅ in_progress 상태의 태스크가 없습니다."
  exit 0
fi

echo "📋 in_progress 태스크 ${#stuck_files[@]}개 발견"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

done_count=0
failed_count=0
stopped_count=0

for tf in "${stuck_files[@]}"; do
  task_id=$(get_field "$tf" "id")
  title=$(get_field "$tf" "title")
  retry_log="$LOG_DIR/${task_id}-retry.log"
  branch=$(get_field "$tf" "branch")
  worktree_rel=$(get_field "$tf" "worktree")
  worktree_path="$REPO_ROOT/$worktree_rel"

  new_status=""

  if [ -f "$retry_log" ]; then
    last_line=$(tail -1 "$retry_log")

    if echo "$last_line" | grep -q "리뷰 승인됨"; then
      new_status="done"
    elif echo "$last_line" | grep -q "failed 처리\|상한.*초과"; then
      new_status="failed"
    else
      # 로그는 있지만 최종 결과 없음 → 중간에 끊긴 것
      new_status="stopped"
    fi
  else
    # 로그 자체가 없음 → 시작도 못 한 것
    new_status="stopped"
  fi

  echo ""
  echo "  ${task_id}: ${title}"
  echo "    현재: in_progress → 변경: ${new_status}"

  if $DRY_RUN; then
    case "$new_status" in
      done)    done_count=$((done_count + 1)) ;;
      failed)  failed_count=$((failed_count + 1)) ;;
      stopped) stopped_count=$((stopped_count + 1)) ;;
    esac
    continue
  fi

  # 상태 업데이트
  sed_inplace "s/^status: .*/status: ${new_status}/" "$tf"

  case "$new_status" in
    done)
      done_count=$((done_count + 1))
      # 머지 시도
      if [ -n "$branch" ] && git -C "$REPO_ROOT" rev-parse --verify "$branch" &>/dev/null; then
        if git -C "$REPO_ROOT" log --oneline "${BASE_BRANCH}..$branch" 2>/dev/null | grep -q .; then
          echo "    🔀 $branch → ${BASE_BRANCH} 머지"
          git -C "$REPO_ROOT" merge "$branch" --no-ff --no-edit || echo "    ⚠️  머지 충돌 — 수동 처리 필요"
        fi
        git -C "$REPO_ROOT" branch -d "$branch" 2>/dev/null || true
      fi
      # worktree 정리
      if [ -d "$worktree_path" ]; then
        git -C "$REPO_ROOT" worktree remove "$worktree_path" --force 2>/dev/null || true
        echo "    🧹 worktree 정리됨"
      fi
      ;;
    failed)
      failed_count=$((failed_count + 1))
      # 리뷰 피드백은 output/${task_id}-review-feedback.txt에 이미 존재 → 프론트 AI Result 탭에서 확인 가능
      local_feedback="$OUTPUT_DIR/${task_id}-review-feedback.txt"
      if [ -f "$local_feedback" ]; then
        echo "    📝 리뷰 피드백: output/${task_id}-review-feedback.txt"
      fi
      # worktree 정리
      if [ -d "$worktree_path" ]; then
        git -C "$REPO_ROOT" worktree remove "$worktree_path" --force 2>/dev/null || true
        echo "    🧹 worktree 정리됨"
      fi
      ;;
    stopped)
      stopped_count=$((stopped_count + 1))
      echo "    ⏸️  worktree 유지 (재시작 가능)"
      ;;
  esac

  git -C "$REPO_ROOT" add "$tf"
done

# 변경된 파일 한번에 커밋
if ! $DRY_RUN && [ $((done_count + failed_count + stopped_count)) -gt 0 ]; then
  git -C "$REPO_ROOT" diff --cached --quiet || \
    git -C "$REPO_ROOT" commit -m "chore: cleanup stuck in_progress tasks (done=${done_count}, failed=${failed_count}, stopped=${stopped_count})"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 정리 완료: done=${done_count}, failed=${failed_count}, stopped=${stopped_count}"
