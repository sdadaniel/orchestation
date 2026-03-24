---
id: REQ-022
title: Task 삭제 원자성 확보
status: done
priority: high
created: 2026-03-24
---
task 삭제 시 task 파일 삭제 후 sprint 파일 수정이 비원자적으로 수행되어, 중간 실패 시 데이터 불일치 발생.

## 문제
- `api/tasks/[id]/route.ts:124-142`
- task 파일 삭제 → sprint 파일 순회 수정 사이에 crash 발생 시 rollback 없음

## Completion Criteria
- sprint 파일 수정을 먼저 수행 후 task 파일 삭제 (또는 try-catch rollback)
- 중간 실패 시 일관된 상태 유지
