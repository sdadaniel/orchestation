---
id: REQ-020
title: auto-improve 배열 확장 문법 수정
status: done
priority: high
created: 2026-03-24
---
auto-improve.sh에서 비표준 bash 배열 확장 문법 사용으로 빈 배열에서 예측 불가 동작 발생.

## 문제
- `scripts/auto-improve.sh:311, 400, 407, 429`
- `"${ARRAY[@]+"${ARRAY[@]}"}"` 비표준 패턴 사용
- 빈 배열에서 word-splitting 이슈 발생 가능

## Completion Criteria
- 배열 길이 체크 후 반복 또는 표준 패턴으로 교체
- 빈 배열, 단일 요소, 다수 요소 모두 정상 동작
