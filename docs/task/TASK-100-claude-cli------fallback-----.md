---
id: TASK-100
title: Claude CLI 실패 처리 강화 - fallback 포맷 통일 및 필드 검증
status: in_progress
priority: medium
sprint:
depends_on: [TASK-099]
branch: task/TASK-100-claude-cli------fallback-----
worktree: ../repo-wt-TASK-100
role: general
reviewer_role: reviewer-general
---

# TASK-100: Claude CLI 실패 처리 강화 - fallback 포맷 통일 및 필드 검증

## 원본 요청

- Request: REQ-031
- 제목: Claude CLI 실패 처리 강화
- 내용: auto-improve.sh에서 Claude CLI 호출 실패 시 하드코딩된 "reject" 응답이 후속 파싱에서 포맷 불일치를 유발할 수 있음.

## 문제
- `scripts/auto-improve.sh:87-89`, `analyze-dependencies.sh:63-64`
- Claude 호출 실패 시 fallback 응답의 포맷이 실제 응답과 다를 수 있음
- DECISION/REASON 필드 존재 여부 검증 없음

## Completion Criteria
- fallback 응답이 실제 Claude 응답과 동일한 포맷 보장
- 응답 파싱 전 필수 필드 존재 여부 검증

## 완료 조건

- `scripts/auto-improve.sh:87-89`의 fallback 응답을 실제 Claude 응답과 동일한 DECISION/REASON 포맷으로 수정
- `scripts/analyze-dependencies.sh:63-64`의 fallback 응답도 동일하게 포맷 통일
- 응답 파싱 전 DECISION, REASON 필드 존재 여부 검증 로직 추가
- 필드 누락 시 명확한 에러 메시지 출력 및 안전한 fallback 처리
