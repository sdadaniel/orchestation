---
id: TASK-094
title: Task 삭제 원자성 확보 (sprint 수정 선행 후 task 파일 삭제)
status: done
priority: high
sprint:
depends_on: [TASK-093]
branch: task/TASK-094-task----sprint----task--
worktree: ../repo-wt-TASK-094
role: general
reviewer_role: reviewer-general
---

# TASK-094: Task 삭제 원자성 확보 (sprint 수정 선행 후 task 파일 삭제)

## 원본 요청

- Request: REQ-022
- 제목: Task 삭제 원자성 확보
- 내용: task 삭제 시 task 파일 삭제 후 sprint 파일 수정이 비원자적으로 수행되어, 중간 실패 시 데이터 불일치 발생.

## 문제
- `api/tasks/[id]/route.ts:124-142`
- task 파일 삭제 → sprint 파일 순회 수정 사이에 crash 발생 시 rollback 없음

## Completion Criteria
- sprint 파일 수정을 먼저 수행 후 task 파일 삭제 (또는 try-catch rollback)
- 중간 실패 시 일관된 상태 유지

## 완료 조건

- `src/frontend/src/app/api/tasks/[id]/route.ts` DELETE 핸들러에서 sprint 파일 수정을 task 파일 삭제보다 먼저 수행하도록 순서 변경
- sprint 파일 수정 중 오류 발생 시 task 파일은 삭제되지 않아 데이터 일관성 유지
- sprint 파일 수정 성공 후 task 파일 삭제, 삭제 실패 시 에러 응답 반환 (sprint 파일은 이미 수정된 상태이므로 재시도 가능해야 함)
- 각 단계 실패 시 적절한 HTTP 에러 응답 반환
