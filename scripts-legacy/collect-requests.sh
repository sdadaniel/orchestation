#!/bin/bash
# collect-requests.sh
# Collects all pending requests and outputs their info as structured data
# Usage: bash scripts/collect-requests.sh [requests_dir]

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

REQUESTS_DIR="${1:?Usage: collect-requests.sh <requests_dir>}"

if [[ ! -d "$REQUESTS_DIR" ]]; then
  echo "[]"
  exit 0
fi


# Get body content (after frontmatter)
get_body() {
  local file="$1"
  awk 'BEGIN{c=0} /^---$/{c++; next} c>=2{print}' "$file"
}

# Find all pending requests sorted by filename
PENDING_FILES=$(find "$REQUESTS_DIR" -name "REQ-*.md" -exec grep -l "^status: pending" {} \; 2>/dev/null | sort || true)

if [[ -z "$PENDING_FILES" ]]; then
  echo "[]"
  exit 0
fi

# Output each request as a line: FILE|ID|TITLE|PRIORITY
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  id=$(get_field "$file" "id")
  title=$(get_field "$file" "title")
  priority=$(get_field "$file" "priority")
  echo "${file}|${id}|${title}|${priority}"
done <<< "$PENDING_FILES"
