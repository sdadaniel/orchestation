#!/bin/bash
# 머지 충돌 발생 시 Claude로 자동 해결 + Notice 보고

NOTICE_API="http://localhost:3000/api/notices"

resolve_merge_conflict() {
  local repo_root="$1"
  local task_id="$2"
  local branch="$3"
  local base_branch="${4:-${BASE_BRANCH:-main}}"

  local conflict_files
  conflict_files=$(git -C "$repo_root" diff --name-only --diff-filter=U)
  [ -z "$conflict_files" ] && return 0

  echo "  🔧 ${task_id}: 머지 충돌 감지 — Claude로 자동 해결 시도"
  echo "     충돌 파일: $conflict_files"

  # Claude에게 충돌 해결 요청 (타임아웃 + 에러 처리)
  local prompt="${branch}를 ${base_branch}에 머지하는 중 충돌이 발생했습니다. 다음 파일들의 충돌 마커(<<<<<<< ======= >>>>>>>)를 해결하세요.
두 변경사항의 의도를 모두 살려서 병합하세요. 충돌 마커를 제거하고 올바른 코드만 남기세요.

충돌 파일:
$conflict_files"

  cd "$repo_root"
  local claude_exit=0
  if command -v timeout &>/dev/null; then
    timeout 300 bash -c 'echo "$1" | claude --output-format json --dangerously-skip-permissions' _ "$prompt" || claude_exit=$?
  else
    # macOS에 timeout 없을 수 있음 — gtimeout 또는 직접 실행
    echo "$prompt" | claude --output-format json --dangerously-skip-permissions || claude_exit=$?
  fi

  if [ "$claude_exit" -eq 124 ]; then
    echo "  ⏰ ${task_id}: Claude 충돌 해결 타임아웃 (5분)"
    git -C "$repo_root" merge --abort 2>/dev/null || true
    return 1
  elif [ "$claude_exit" -ne 0 ]; then
    echo "  ❌ ${task_id}: Claude 호출 실패 (exit=$claude_exit)"
    git -C "$repo_root" merge --abort 2>/dev/null || true
    return 1
  fi

  # 충돌 마커 잔존 확인
  if git -C "$repo_root" diff --check 2>&1 | grep -q "conflict"; then
    echo "  ⚠️ ${task_id}: 충돌 마커 잔존 감지"
    git -C "$repo_root" merge --abort 2>/dev/null || true
    return 1
  fi

  # 해결 확인
  local remaining
  remaining=$(git -C "$repo_root" diff --name-only --diff-filter=U)

  if [ -n "$remaining" ]; then
    # 해결 실패 → abort + Notice(error)
    git -C "$repo_root" merge --abort
    local conflict_list
    conflict_list=$(echo "$conflict_files" | sed 's/^/- /')
    post_notice "error" \
      "${task_id} 머지 충돌 자동 해결 실패" \
      "**Branch:** \`${branch}\`

**충돌 파일:**
${conflict_list}

Claude가 자동 해결에 실패했습니다. 수동 확인이 필요합니다."
    echo "  ❌ ${task_id}: 자동 해결 실패"
    return 1
  fi

  # 해결 성공 → 커밋 + Notice(warning)
  git -C "$repo_root" add -A
  git -C "$repo_root" commit --no-edit
  local conflict_list2
  conflict_list2=$(echo "$conflict_files" | sed 's/^/- /')
  post_notice "warning" \
    "${task_id} 머지 충돌 자동 해결 완료" \
    "**Branch:** \`${branch}\`

**충돌 파일:**
${conflict_list2}

Claude가 자동으로 충돌을 해결했습니다. 결과를 확인해주세요."
  echo "  ✅ ${task_id}: 머지 충돌 자동 해결 완료 (Notice 생성)"
  return 0
}

post_notice() {
  local type="$1"
  local title="$2"
  local content="$3"

  curl -s -X POST "$NOTICE_API" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg t "$title" --arg c "$content" --arg ty "$type" \
      '{title: $t, content: $c, type: $ty}')" \
    > /dev/null 2>&1 || true
}
