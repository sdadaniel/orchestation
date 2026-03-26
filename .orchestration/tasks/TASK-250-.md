---
id: TASK-250
title: notices-api-file-io-error-handling-보고서-작성
status: pending
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/app/api/notices/[id]/route.ts
  - docs/todo/notices-api-file-io-safety.md
---
notices/[id] API 라우트의 파일 I/O 에러 핸들링 미비 사항을 분석하고 docs/todo/에 보고서를 작성한다.

PUT 핸들러의 `fs.readFileSync` (line 30), `fs.writeFileSync` (line 51)와
DELETE 핸들러의 `fs.unlinkSync` (line 64)가 try-catch 없이 호출되고 있어,
파일 시스템 오류 발생 시 500 에러가 클라이언트에 전파될 수 있다.

분석 보고서에는 다음을 포함한다:
- 영향받는 핸들러 및 라인 번호
- 발생 가능한 장애 시나리오 (TOCTOU, 디스크 오류 등)
- 권장 수정 방안 (try-catch 추가 및 적절한 HTTP 응답 반환)

## Completion Criteria
- docs/todo/notices-api-file-io-safety.md 보고서 파일 생성 완료
- 보고서에 영향 범위, 장애 시나리오, 권장 수정 방안이 포함됨
