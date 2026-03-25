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

  # Claude에게 충돌 해결 요청
  local prompt="${branch}를 ${base_branch}에 머지하는 중 충돌이 발생했습니다. 다음 파일들의 충돌 마커(<<<<<<< ======= >>>>>>>)를 해결하세요.
두 변경사항의 의도를 모두 살려서 병합하세요. 충돌 마커를 제거하고 올바른 코드만 남기세요.

충돌 파일:
$conflict_files"

  cd "$repo_root"
  echo "$prompt" | claude --output-format json --dangerously-skip-permissions

  # 해결 확인
  local remaining
  remaining=$(git -C "$repo_root" diff --name-only --diff-filter=U)

  if [ -n "$remaining" ]; then
    # 해결 실패 → abort + Notice(error)
    git -C "$repo_root" merge --abort
    post_notice "error" \
      "${task_id} 머지 충돌 자동 해결 실패" \
      "**Branch:** \`${branch}\`\n\n**충돌 파일:**\n$(echo "$conflict_files" | sed 's/^/- /')\n\nClaude가 자동 해결에 실패했습니다. 수동 확인이 필요합니다."
    echo "  ❌ ${task_id}: 자동 해결 실패"
    return 1
  fi

  # 해결 성공 → 커밋 + Notice(warning)
  git -C "$repo_root" add -A
  git -C "$repo_root" commit --no-edit
  post_notice "warning" \
    "${task_id} 머지 충돌 자동 해결 완료" \
    "**Branch:** \`${branch}\`\n\n**충돌 파일:**\n$(echo "$conflict_files" | sed 's/^/- /')\n\nClaude가 자동으로 충돌을 해결했습니다. 결과를 확인해주세요."
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
