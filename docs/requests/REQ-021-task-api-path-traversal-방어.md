---
id: REQ-021
title: Task API path traversal 방어
status: done
priority: high
created: 2026-03-24
---
tasks/[id] API 라우트의 findTaskFile()에서 prefix 매칭만 사용하여 path traversal 취약점 존재.

## 문제
- `api/tasks/[id]/route.ts` — `file.startsWith(taskId)` prefix 매칭만 수행
- taskId 검증 없이 파일시스템 접근 → 의도하지 않은 파일 접근 가능

## Completion Criteria
- taskId가 정규식(`/^TASK-\d{3}$/` 등)으로 검증된다
- resolve된 경로가 TASKS_DIR 내부인지 확인한다
- 잘못된 ID에 대해 400 또는 404 응답
