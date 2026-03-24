---
id: REQ-026
title: Requests API 파일 삭제 race condition
status: done
priority: medium
created: 2026-03-24
---
requests/[id] API에서 writeFileSync → unlinkSync 사이에 다른 프로세스가 파일을 삭제하면 crash 발생.

## 문제
- `api/requests/[id]/route.ts`
- 파일 쓰기 후 이전 파일 삭제 사이에 외부 프로세스 간섭 가능

## Completion Criteria
- try-catch로 unlinkSync 에러 핸들링
- 파일 존재 여부 확인 후 삭제 또는 에러 무시 처리
