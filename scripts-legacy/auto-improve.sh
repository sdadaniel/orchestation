#!/bin/bash
# auto-improve.sh
# Picks up pending requests, analyzes dependencies via Claude,
# creates tasks in parallel for independent requests, sequential for dependent ones
# Usage: bash scripts/auto-improve.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$PROJECT_ROOT/scripts/lib/common.sh"
source "$PROJECT_ROOT/scripts/lib/sed-inplace.sh"
REQUESTS_DIR="$PROJECT_ROOT/docs/requests"
ORCHESTRATE="$PROJECT_ROOT/scripts/orchestrate.sh"
COLLECT_REQUESTS="$PROJECT_ROOT/scripts/collect-requests.sh"
ANALYZE_DEPS="$PROJECT_ROOT/scripts/analyze-dependencies.sh"

SLEEP_INTERVAL=${SLEEP_INTERVAL:-30}
STOP_FLAG="$PROJECT_ROOT/.auto-improve-stop"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Check if graceful stop was requested
check_stop_flag() {
  if [[ -f "$STOP_FLAG" ]]; then
    log "Stop flag detected ($STOP_FLAG). Shutting down gracefully..."
    rm -f "$STOP_FLAG"
    exit 0
  fi
}

# Update request status in markdown frontmatter
update_status() {
  local file="$1"
  local new_status="$2"

  sed_inplace "s/^status: .*/status: ${new_status}/" "$file"
  log "Updated $(basename "$file") -> status: $new_status"
}


# Get body content (after frontmatter)
get_body() {
  local file="$1"
  awk 'BEGIN{c=0} /^---$/{c++; next} c>=2{print}' "$file"
}

# Validate eval response: ensure DECISION and REASON fields exist
# If missing, return a safe fallback with clear error message
validate_eval_response() {
  local response="$1"
  local req_id="$2"

  # 응답이 비어있는 경우
  if [[ -z "$response" ]]; then
    log "ERROR: [$req_id] Claude 응답이 비어있습니다. 안전한 fallback을 사용합니다."
    echo "DECISION: reject
REASON: Claude 응답이 비어있음 — 자동 reject 처리"
    return 0
  fi

  local has_decision=false
  local has_reason=false

  echo "$response" | grep -q "^DECISION:" && has_decision=true
  echo "$response" | grep -q "^REASON:" && has_reason=true

  if [[ "$has_decision" == false || "$has_reason" == false ]]; then
    local missing_fields=""
    [[ "$has_decision" == false ]] && missing_fields="DECISION"
    [[ "$has_reason" == false ]] && missing_fields="${missing_fields:+$missing_fields, }REASON"

    log "ERROR: [$req_id] 응답에 필수 필드 누락: $missing_fields. 안전한 fallback을 사용합니다."
    log "ERROR: [$req_id] 원본 응답 (첫 200자): $(echo "$response" | head -c 200)"

    echo "DECISION: reject
REASON: 응답 파싱 실패 (필수 필드 누락: $missing_fields) — 자동 reject 처리"
    return 0
  fi

  # DECISION 값 검증: accept 또는 reject만 허용
  local decision_value
  decision_value=$(echo "$response" | grep "^DECISION:" | head -1 | sed 's/^DECISION: *//' | tr -d '[:space:]')
  if [[ "$decision_value" != "accept" && "$decision_value" != "reject" ]]; then
    log "ERROR: [$req_id] DECISION 값이 유효하지 않음: '$decision_value'. accept/reject만 허용됩니다."
    echo "DECISION: reject
REASON: DECISION 값 오류 ('$decision_value') — 자동 reject 처리"
    return 0
  fi

  echo "$response"
}

# Evaluate a single request via Claude (accept/reject)
# Returns the eval result text; sets EVAL_DECISION global
evaluate_request() {
  local req_id="$1"
  local req_title="$2"
  local req_priority="$3"
  local req_body="$4"

  local eval_prompt="너는 소프트웨어 개발 태스크 매니저다.

아래 개선 요청을 분석하고, 실행 가능한지 판단해라.

요청 ID: $req_id
제목: $req_title
우선순위: $req_priority
내용: $req_body

판단 기준:
- 요청이 구체적인가? (어떤 파일, 어떤 기능, 어떤 변경인지 파악 가능한가?)
- 범위가 명확한가? (하나의 태스크로 완료할 수 있는 크기인가?)
- 모호하거나 추상적인가? (\"좋게 해줘\", \"개선해줘\" 같은 표현만 있는가?)

반드시 다음 형식으로만 답변해라:
DECISION: accept 또는 reject
REASON: 한줄 사유
TASK_TITLE: (accept일 경우) 태스크 제목
TASK_DESCRIPTION: (accept일 경우) 구체적인 완료 조건 목록
SCOPE: (accept일 경우) 수정 대상 파일 경로 목록 (콤마 구분, src/ 기준 상대경로). 보수적으로 넓게 잡아라 — 직접 수정할 파일뿐 아니라 관련 훅, 유틸, 타입 파일도 포함해라. 확실하지 않으면 디렉토리 단위로 넓게 잡아도 된다."

  local eval_result=""
  if command -v claude &>/dev/null; then
    eval_result=$(echo "$eval_prompt" | claude --print --model claude-sonnet-4-6 2>/dev/null) || true
  fi

  # 필수 필드 검증 및 fallback 처리
  eval_result=$(validate_eval_response "$eval_result" "$req_id")

  echo "$eval_result"
}

# Enrich request file with orchestration fields (branch, worktree, role, completion criteria)
# Request 파일 자체를 실행 단위로 사용 — 별도 task 파일 생성 안 함
enrich_request() {
  local req_file="$1"
  local req_id="$2"
  local eval_result="$3"

  local task_desc
  task_desc=$(echo "$eval_result" | sed -n '/^TASK_DESCRIPTION:/,/^SCOPE:/{ /^SCOPE:/d; p }' | tail -n +2)
  if [[ -z "$task_desc" ]]; then
    task_desc=$(echo "$eval_result" | sed -n '/^TASK_DESCRIPTION:/,$ p' | tail -n +2)
  fi

  # SCOPE 파싱: 콤마 구분 → YAML 리스트로 변환
  local scope_line scope_yaml=""
  scope_line=$(echo "$eval_result" | grep "^SCOPE:" | head -1 | sed 's/^SCOPE: *//')
  if [[ -n "$scope_line" ]]; then
    scope_yaml="scope:"
    IFS=',' read -ra SCOPE_ITEMS <<< "$scope_line"
    for item in "${SCOPE_ITEMS[@]}"; do
      item=$(echo "$item" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      [[ -n "$item" ]] && scope_yaml="${scope_yaml}
  - ${item}"
    done
  fi

  local slug
  slug=$(echo "$req_id" | tr '[:upper:]' '[:lower:]')

  # frontmatter에 branch, worktree, role, reviewer_role, scope 추가 (없으면)
  if ! grep -q '^branch:' "$req_file"; then
    local extra_fields="branch: task/${slug}
worktree: ../repo-wt-${slug}
role: general
reviewer_role: reviewer-general
depends_on: []"
    if [[ -n "$scope_yaml" ]]; then
      extra_fields="${extra_fields}
${scope_yaml}"
    fi
    # awk로 status: 행 뒤에 필드 삽입 (macOS/Linux 호환)
    local tmpfile
    tmpfile=$(mktemp)
    awk -v fields="$extra_fields" '/^status:/{print; print fields; next} 1' "$req_file" > "$tmpfile"
    mv "$tmpfile" "$req_file"
  fi

  # 완료 조건을 본문에 추가 (이미 없으면)
  if [[ -n "$task_desc" ]] && ! grep -q '## Completion Criteria' "$req_file"; then
    echo "" >> "$req_file"
    echo "## Completion Criteria" >> "$req_file"
    echo "$task_desc" >> "$req_file"
  fi

  # status를 pending으로 변경 (orchestrate가 인식)
  update_status "$req_file" "pending"

  log "Enriched $req_id with orchestration fields"
}

# ──────────────────────────────────────────────────────────
# Main daemon loop
# ──────────────────────────────────────────────────────────

log "Auto-improve daemon started (parallel mode)"
log "Watching: $REQUESTS_DIR"
log "Sleep interval: ${SLEEP_INTERVAL}s"

while true; do
  check_stop_flag

  # ── Step 0: Run orchestrate for already-pending TASK files ──
  local _task_search_dir="$PROJECT_ROOT/docs/task"
  [ -d "$PROJECT_ROOT/.orchestration/tasks" ] && _task_search_dir="$PROJECT_ROOT/.orchestration/tasks"
  PENDING_TASK_COUNT=$(find "$_task_search_dir" -name "TASK-*.md" -exec grep -l "^status: pending" {} \; 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$PENDING_TASK_COUNT" -gt 0 ]] && [[ -x "$ORCHESTRATE" ]]; then
    log "Found $PENDING_TASK_COUNT pending task(s) — running orchestrate..."
    ORCHESTRATE_EXIT=0
    ORCHESTRATE_OUTPUT=$(bash "$ORCHESTRATE" 2>&1) || ORCHESTRATE_EXIT=$?
    while IFS= read -r line; do
      log "[orchestrate] $line"
    done <<< "$ORCHESTRATE_OUTPUT"
    if [[ ${ORCHESTRATE_EXIT:-0} -ne 0 ]]; then
      log "Warning: Orchestration had errors (exit code: ${ORCHESTRATE_EXIT})"
    fi
    log "✅ Orchestration for existing tasks completed"
    check_stop_flag
  fi

  # ── Step 1: Collect ALL pending requests ──
  PENDING_LINES=""
  if [[ -d "$REQUESTS_DIR" ]]; then
    PENDING_LINES=$(bash "$COLLECT_REQUESTS" "$REQUESTS_DIR" 2>/dev/null || true)
  fi

  if [[ -z "$PENDING_LINES" || "$PENDING_LINES" == "[]" ]]; then
    log "No pending requests. Sleeping..."
    sleep "$SLEEP_INTERVAL"
    continue
  fi

  # Parse collected requests into arrays
  declare -a REQ_FILES=()
  declare -a REQ_IDS=()
  declare -a REQ_TITLES=()
  declare -a REQ_PRIORITIES=()
  declare -a REQ_BODIES=()

  while IFS='|' read -r file id title priority; do
    [[ -z "$file" ]] && continue
    REQ_FILES+=("$file")
    REQ_IDS+=("$id")
    REQ_TITLES+=("$title")
    REQ_PRIORITIES+=("$priority")
    REQ_BODIES+=("$(get_body "$file")")
  done <<< "$PENDING_LINES"

  TOTAL_COUNT=${#REQ_IDS[@]}
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Found $TOTAL_COUNT pending request(s): ${REQ_IDS[*]}"

  # ── Step 2: Evaluate each request (accept/reject) ──
  declare -a ACCEPTED_INDICES=()
  declare -a EVAL_RESULTS=()

  for i in "${!REQ_IDS[@]}"; do
    check_stop_flag

    log "Evaluating ${REQ_IDS[$i]}: ${REQ_TITLES[$i]}..."
    update_status "${REQ_FILES[$i]}" "in_progress"

    eval_result=$(evaluate_request "${REQ_IDS[$i]}" "${REQ_TITLES[$i]}" "${REQ_PRIORITIES[$i]}" "${REQ_BODIES[$i]}")
    EVAL_RESULTS+=("$eval_result")

    decision=$(echo "$eval_result" | grep "^DECISION:" | head -1 | sed 's/DECISION: *//')

    if [[ "$decision" != "accept" ]]; then
      reject_reason=$(echo "$eval_result" | grep "^REASON:" | head -1 | sed 's/REASON: *//')
      update_status "${REQ_FILES[$i]}" "rejected"

      echo "" >> "${REQ_FILES[$i]}"
      echo "---" >> "${REQ_FILES[$i]}"
      echo "**거절 사유:** $reject_reason" >> "${REQ_FILES[$i]}"
      echo "**거절 시각:** $(date '+%Y-%m-%d %H:%M:%S')" >> "${REQ_FILES[$i]}"

      log "Rejected ${REQ_IDS[$i]}: $reject_reason"
    else
      log "Accepted ${REQ_IDS[$i]}"
      ACCEPTED_INDICES+=("$i")
    fi
  done

  ACCEPTED_COUNT=${#ACCEPTED_INDICES[@]}

  if [[ $ACCEPTED_COUNT -eq 0 ]]; then
    log "All requests rejected. Continuing..."
    unset REQ_FILES REQ_IDS REQ_TITLES REQ_PRIORITIES REQ_BODIES EVAL_RESULTS ACCEPTED_INDICES
    sleep 2
    continue
  fi

  log "$ACCEPTED_COUNT request(s) accepted out of $TOTAL_COUNT"

  # ── Step 3: Dependency analysis (only if multiple accepted requests) ──
  declare -a INDEPENDENT_INDICES=()
  declare -a DEPENDENT_PAIRS=()

  if [[ $ACCEPTED_COUNT -le 1 ]]; then
    # Single request: trivially independent
    if [[ ${#ACCEPTED_INDICES[@]} -gt 0 ]]; then
      INDEPENDENT_INDICES=("${ACCEPTED_INDICES[@]}")
    fi
    log "Single accepted request — no dependency analysis needed"
  else
    # Build request summary for dependency analysis
    REQ_SUMMARY=""
    for idx in "${ACCEPTED_INDICES[@]}"; do
      body_oneline=$(echo "${REQ_BODIES[$idx]}" | tr '\n' ' ' | cut -c1-200)
      REQ_SUMMARY+="${REQ_IDS[$idx]}|${REQ_TITLES[$idx]}|${body_oneline}"$'\n'
    done
    REQ_SUMMARY=$(echo "$REQ_SUMMARY" | sed '/^$/d')

    log "Analyzing dependencies between ${ACCEPTED_COUNT} requests via Claude..."

    ANALYSIS_OUTPUT=$(bash "$ANALYZE_DEPS" "$REQ_SUMMARY" 2>/dev/null || echo "ERROR")

    if [[ "$ANALYSIS_OUTPUT" == "ERROR" ]]; then
      log "Dependency analysis failed — treating all as independent"
      if [[ ${#ACCEPTED_INDICES[@]} -gt 0 ]]; then
        INDEPENDENT_INDICES=("${ACCEPTED_INDICES[@]}")
      fi
    else
      log "Dependency analysis result:"
      while IFS= read -r line; do
        log "  $line"
      done < <(echo "$ANALYSIS_OUTPUT")

      # Parse INDEPENDENT line
      INDEP_LINE=$(echo "$ANALYSIS_OUTPUT" | grep "^INDEPENDENT:" | head -1 | sed 's/^INDEPENDENT: *//' || true)

      if [[ -n "$INDEP_LINE" ]]; then
        # Map request IDs back to indices
        IFS=',' read -ra INDEP_IDS <<< "$INDEP_LINE"
        if [[ ${#INDEP_IDS[@]} -gt 0 ]]; then
        for indep_id_raw in "${INDEP_IDS[@]}"; do
          indep_id=$(echo "$indep_id_raw" | tr -d ' ')
          for idx in "${ACCEPTED_INDICES[@]}"; do
            if [[ "${REQ_IDS[$idx]}" == "$indep_id" ]]; then
              INDEPENDENT_INDICES+=("$idx")
              break
            fi
          done
        done
        fi
      fi

      # Parse DEPENDENT lines
      while IFS= read -r dep_line; do
        [[ -z "$dep_line" ]] && continue
        dep_content=$(echo "$dep_line" | sed 's/^DEPENDENT: *//')
        DEPENDENT_PAIRS+=("$dep_content")

        # Extract IDs from dependent pairs that aren't already in independent
        from_id=$(echo "$dep_content" | sed 's/ *->.*$//' | tr -d ' ')
        to_id=$(echo "$dep_content" | sed 's/^.*-> *//' | tr -d ' ')

        for dep_id in "$from_id" "$to_id"; do
          found=false
          if [[ ${#INDEPENDENT_INDICES[@]} -gt 0 ]]; then
            for existing in "${INDEPENDENT_INDICES[@]}"; do
              if [[ "${REQ_IDS[$existing]}" == "$dep_id" ]]; then
                found=true
                break
              fi
            done
          fi
          # Dependent IDs are handled separately, not added to independent
        done
      done <<< "$(echo "$ANALYSIS_OUTPUT" | grep "^DEPENDENT:" || true)"

      # If no independent requests found, fall back to all independent
      if [[ ${#INDEPENDENT_INDICES[@]} -eq 0 && ${#DEPENDENT_PAIRS[@]} -eq 0 ]]; then
        log "No clear dependency info — treating all as independent"
        if [[ ${#ACCEPTED_INDICES[@]} -gt 0 ]]; then
          INDEPENDENT_INDICES=("${ACCEPTED_INDICES[@]}")
        fi
      fi
    fi
  fi

  # ── Step 4: Create tasks for independent requests (batch 0, parallel) ──
  INDEP_COUNT=${#INDEPENDENT_INDICES[@]}
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Processing plan:"
  log "  병렬 처리 (independent): $INDEP_COUNT request(s)"
  log "  순차 처리 (dependent):   ${#DEPENDENT_PAIRS[@]} pair(s)"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  ENRICHED_REQ_FILES=()
  ENRICHED_REQ_IDS=()

  # EVAL_RESULTS는 ACCEPTED_INDICES 순서로 저장되므로 인덱스 매핑 생성
  declare -A EVAL_RESULTS_MAP=()
  for _ai in "${!ACCEPTED_INDICES[@]}"; do
    EVAL_RESULTS_MAP[${ACCEPTED_INDICES[$_ai]}]="${EVAL_RESULTS[$_ai]}"
  done

  if [[ $INDEP_COUNT -gt 0 ]]; then
    log "▶ Enriching $INDEP_COUNT request(s) for parallel processing..."

    for idx in "${INDEPENDENT_INDICES[@]}"; do
      enrich_request \
        "${REQ_FILES[$idx]}" \
        "${REQ_IDS[$idx]}" \
        "${EVAL_RESULTS_MAP[$idx]}"

      ENRICHED_REQ_FILES+=("${REQ_FILES[$idx]}")
      ENRICHED_REQ_IDS+=("${REQ_IDS[$idx]}")
    done

    # Git commit enriched requests
    cd "$PROJECT_ROOT"
    for rf in "${ENRICHED_REQ_FILES[@]}"; do
      git add "$rf" 2>/dev/null || true
    done
    BATCH_LABEL=$(IFS=,; echo "${ENRICHED_REQ_IDS[*]}")
    git commit -m "chore(${BATCH_LABEL}): enriched for orchestration" 2>/dev/null || true

    # Run orchestrate.sh — it now reads docs/requests/ too
    if [[ -x "$ORCHESTRATE" ]]; then
      log "Running orchestration for: ${ENRICHED_REQ_IDS[*]}"
      ORCHESTRATE_EXIT=0
      ORCHESTRATE_OUTPUT=$(bash "$ORCHESTRATE" 2>&1) || ORCHESTRATE_EXIT=$?
      while IFS= read -r line; do
        log "[orchestrate] $line"
      done <<< "$ORCHESTRATE_OUTPUT"
      if [[ ${ORCHESTRATE_EXIT:-0} -ne 0 ]]; then
        log "Warning: Orchestration had errors (exit code: ${ORCHESTRATE_EXIT})"
      fi
    fi

    log "✅ Parallel batch completed: ${ENRICHED_REQ_IDS[*]}"
  fi

  # ── Step 5: Handle dependent requests sequentially ──
  if [[ ${#DEPENDENT_PAIRS[@]} -gt 0 ]]; then
    log "▶ Processing ${#DEPENDENT_PAIRS[@]} dependent pair(s) sequentially..."

    # Collect all dependent request IDs (deduplicated, ordered)
    declare -a DEP_ORDER=()
    for pair in "${DEPENDENT_PAIRS[@]}"; do
      from_id=$(echo "$pair" | sed 's/ *->.*$//' | tr -d ' ')
      to_id=$(echo "$pair" | sed 's/^.*-> *//' | tr -d ' ')

      # Add from_id if not already in order
      found=false
      if [[ ${#DEP_ORDER[@]} -gt 0 ]]; then
        for existing in "${DEP_ORDER[@]}"; do
          [[ "$existing" == "$from_id" ]] && found=true && break
        done
      fi
      [[ "$found" == false ]] && DEP_ORDER+=("$from_id")

      # Add to_id if not already in order
      found=false
      if [[ ${#DEP_ORDER[@]} -gt 0 ]]; then
        for existing in "${DEP_ORDER[@]}"; do
          [[ "$existing" == "$to_id" ]] && found=true && break
        done
      fi
      [[ "$found" == false ]] && DEP_ORDER+=("$to_id")
    done

    # Process each dependent request in order
    PREV_TASK_ID=""
    for dep_req_id in "${DEP_ORDER[@]}"; do
      check_stop_flag

      # Find the index for this request
      dep_idx=""
      for idx in "${ACCEPTED_INDICES[@]}"; do
        if [[ "${REQ_IDS[$idx]}" == "$dep_req_id" ]]; then
          dep_idx="$idx"
          break
        fi
      done

      # Skip if already processed as independent
      already_done=false
      if [[ ${#INDEPENDENT_INDICES[@]} -gt 0 ]]; then
        for ind_idx in "${INDEPENDENT_INDICES[@]}"; do
          if [[ "$ind_idx" == "$dep_idx" ]]; then
            already_done=true
            break
          fi
        done
      fi
      [[ "$already_done" == true ]] && continue

      if [[ -z "$dep_idx" ]]; then
        log "Warning: Could not find request $dep_req_id in accepted list, skipping"
        continue
      fi

      log "Sequential: processing $dep_req_id (depends on: ${PREV_TASK_ID:-none})"

      enrich_request \
        "${REQ_FILES[$dep_idx]}" \
        "${REQ_IDS[$dep_idx]}" \
        "${EVAL_RESULTS_MAP[$dep_idx]}"

      cd "$PROJECT_ROOT"
      git add "${REQ_FILES[$dep_idx]}" 2>/dev/null || true
      git commit -m "chore(${dep_req_id}): enriched for sequential orchestration" 2>/dev/null || true

      if [[ -x "$ORCHESTRATE" ]]; then
        log "Running orchestration for sequential: $dep_req_id..."
        ORCHESTRATE_EXIT=0
        ORCHESTRATE_OUTPUT=$(bash "$ORCHESTRATE" 2>&1) || ORCHESTRATE_EXIT=$?
        while IFS= read -r line; do
          log "[orchestrate] $line"
        done <<< "$ORCHESTRATE_OUTPUT"
        if [[ ${ORCHESTRATE_EXIT:-0} -ne 0 ]]; then
          log "Warning: Orchestration had errors for $dep_req_id (exit code: ${ORCHESTRATE_EXIT})"
        fi
      fi

      log "✅ Sequential completed: $dep_req_id"
    done

    unset DEP_ORDER
  fi

  # ── Step 6: Summary log ──
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Batch processing summary:"
  log "  Total requests processed: $TOTAL_COUNT"
  log "  Accepted: $ACCEPTED_COUNT"
  log "  Rejected: $((TOTAL_COUNT - ACCEPTED_COUNT))"
  if [[ $INDEP_COUNT -gt 0 && ${#ENRICHED_REQ_IDS[@]} -gt 0 ]]; then
    log "  Parallel (independent): $INDEP_COUNT → ${ENRICHED_REQ_IDS[*]}"
  elif [[ $INDEP_COUNT -gt 0 ]]; then
    log "  Parallel (independent): $INDEP_COUNT request(s)"
  fi
  if [[ ${#DEPENDENT_PAIRS[@]} -gt 0 ]]; then
    log "  Sequential (dependent): ${#DEPENDENT_PAIRS[@]} pair(s)"
  fi
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Cleanup arrays for next iteration
  unset REQ_FILES REQ_IDS REQ_TITLES REQ_PRIORITIES REQ_BODIES
  unset EVAL_RESULTS EVAL_RESULTS_MAP ACCEPTED_INDICES INDEPENDENT_INDICES DEPENDENT_PAIRS
  unset ENRICHED_REQ_FILES ENRICHED_REQ_IDS

  sleep 2
done
