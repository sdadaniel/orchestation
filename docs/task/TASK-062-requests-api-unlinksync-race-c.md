---
id: TASK-062
title: Requests API unlinkSync race condition 방어 처리
status: in_progress
priority: medium
sprint:
depends_on: []
branch: task/TASK-062-requests-api-unlinksync-race-c
worktree: ../repo-wt-TASK-062
role: general
reviewer_role: reviewer-general
---

# TASK-062: Requests API unlinkSync race condition 방어 처리

## 원본 요청

- Request: REQ-026
- 제목: Requests API 파일 삭제 race condition
- 내용: requests/[id] API에서 writeFileSync → unlinkSync 사이에 다른 프로세스가 파일을 삭제하면 crash 발생.

## 문제
- `api/requests/[id]/route.ts`
- 파일 쓰기 후 이전 파일 삭제 사이에 외부 프로세스 간섭 가능

## Completion Criteria
- try-catch로 unlinkSync 에러 핸들링
- 파일 존재 여부 확인 후 삭제 또는 에러 무시 처리

## 완료 조건

- `src/frontend/src/app/api/requests/[id]/route.ts`에서 `unlinkSync` 호출을 try-catch로 감싸기
- ENOENT 에러(파일 없음)는 무시하고, 그 외 에러는 로깅 후 무시 또는 re-throw 결정
- 파일 쓰기 성공 후 구 파일 삭제 실패가 전체 요청을 crash시키지 않도록 보장
