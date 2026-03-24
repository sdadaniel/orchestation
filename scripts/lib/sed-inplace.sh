#!/bin/bash
# Cross-platform sed in-place editing helper.
# Usage: sed_inplace <sed-expression> <file>
#
# macOS BSD sed requires `sed -i ''`, GNU sed requires `sed -i`.
# This function detects the OS and uses the correct form.

sed_inplace() {
  local expression="$1"
  local file="$2"

  if [ -z "$expression" ] || [ -z "$file" ]; then
    echo "ERROR: sed_inplace requires <expression> <file>" >&2
    return 1
  fi

  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "$expression" "$file"
  else
    sed -i "$expression" "$file"
  fi
}

# Extended regex variant: sed_inplace_E <expression> <file>
sed_inplace_E() {
  local expression="$1"
  local file="$2"

  if [ -z "$expression" ] || [ -z "$file" ]; then
    echo "ERROR: sed_inplace_E requires <expression> <file>" >&2
    return 1
  fi

  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' -E "$expression" "$file"
  else
    sed -i -E "$expression" "$file"
  fi
}
