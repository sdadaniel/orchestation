---
id: REQ-024
title: sed 크로스플랫폼 호환성
status: done
priority: medium
created: 2026-03-24
---
여러 쉘 스크립트에서 macOS 전용 `sed -i ''` 문법 사용으로 Linux에서 실행 불가.

## 문제
- `scripts/orchestrate.sh:159,223`, `run-pipeline.sh:109`, `auto-improve.sh:38`, `test-parallel-logic.sh:200`
- `sed -i ''`는 macOS BSD sed 전용, GNU sed는 `-i` 만 사용

## Completion Criteria
- OS 감지 후 적절한 sed 옵션 사용 또는 임시파일+mv 패턴으로 교체
- macOS와 Linux 모두에서 정상 동작
