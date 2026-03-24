---
id: REQ-016
title: 태스크 로그 조회 API 엔드포인트 구현
status: pending
priority: high
created: 2026-03-24
---
태스크 ID로 로그를 조회할 수 있는 백엔드 API를 구현한다. 스크립트 실행 로그 파일을 읽거나 기존 로그 소스에서 데이터를 제공한다.

## Completion Criteria
- GET /api/tasks/[id]/logs 엔드포인트가 구현된다
- 태스크 ID에 해당하는 로그 데이터를 반환한다
- 로그 파일이 없거나 태스크가 없을 경우 적절한 에러 응답을 반환한다
- 응답 형식은 [{timestamp, level, message}] 배열이다
