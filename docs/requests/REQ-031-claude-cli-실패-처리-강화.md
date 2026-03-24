---
id: REQ-031
title: Claude CLI 실패 처리 강화
status: done
priority: medium
created: 2026-03-24
---
auto-improve.sh에서 Claude CLI 호출 실패 시 하드코딩된 "reject" 응답이 후속 파싱에서 포맷 불일치를 유발할 수 있음.

## 문제
- `scripts/auto-improve.sh:87-89`, `analyze-dependencies.sh:63-64`
- Claude 호출 실패 시 fallback 응답의 포맷이 실제 응답과 다를 수 있음
- DECISION/REASON 필드 존재 여부 검증 없음

## Completion Criteria
- fallback 응답이 실제 Claude 응답과 동일한 포맷 보장
- 응답 파싱 전 필수 필드 존재 여부 검증
