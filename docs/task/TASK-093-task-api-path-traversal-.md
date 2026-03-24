---
id: TASK-093
title: Task API path traversal 방어
status: in_progress
priority: high
sprint:
depends_on: []
branch: task/TASK-093-task-api-path-traversal-
worktree: ../repo-wt-TASK-093
role: general
reviewer_role: reviewer-general
---

# TASK-093: Task API path traversal 방어

## 원본 요청

- Request: REQ-021
- 제목: Task API path traversal 방어
- 내용: tasks/[id] API 라우트의 findTaskFile()에서 prefix 매칭만 사용하여 path traversal 취약점 존재.

## 문제
- `api/tasks/[id]/route.ts` — `file.startsWith(taskId)` prefix 매칭만 수행
- taskId 검증 없이 파일시스템 접근 → 의도하지 않은 파일 접근 가능

## Completion Criteria
- taskId가 정규식(`/^TASK-\d{3}$/` 등)으로 검증된다
- resolve된 경로가 TASKS_DIR 내부인지 확인한다
- 잘못된 ID에 대해 400 또는 404 응답

## 완료 조건

- `api/tasks/[id]/route.ts`의 `findTaskFile()`에서 taskId를 `/^TASK-\d{3}$/` 정규식으로 검증
- `path.resolve()`로 실제 경로를 계산한 후 TASKS_DIR 내부인지 확인
- 검증 실패 시 400, 파일 없을 시 404 응답 반환
