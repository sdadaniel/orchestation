#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

rm -rf "$ROOT_DIR"/prompt*/
echo "모든 prompt 디렉토리가 삭제되었습니다."
