---
id: REQ-030
title: auto-improve subshell pipe 문제
status: done
priority: medium
created: 2026-03-24
---
auto-improve.sh에서 pipe + while 루프가 subshell에서 실행되어 루프 내 변수 변경이 부모 셸에 전파되지 않음.

## 문제
- `scripts/auto-improve.sh:278, 373, 467`
- `cmd | while read` 패턴에서 while은 subshell → 변수 변경 유실
- orchestration 에러가 조용히 무시됨

## Completion Criteria
- process substitution(`while read < <(cmd)`) 또는 임시파일 패턴으로 교체
- 루프 내 변수 변경이 정상 전파되고 에러가 감지됨
