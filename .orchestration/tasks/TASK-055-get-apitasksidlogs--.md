---
id: TASK-055
title: GET /api/tasks/[id]/logs 엔드포인트 구현
status: done
priority: high
sprint:
depends_on: []
branch: task/TASK-055-get-apitasksidlogs--
worktree: ../repo-wt-TASK-055
role: general
reviewer_role: reviewer-general
---

# TASK-055: GET /api/tasks/[id]/logs 엔드포인트 구현

## 원본 요청

- Request: REQ-016
- 제목: 태스크 로그 조회 API 엔드포인트 구현
- 내용: 태스크 ID로 로그를 조회할 수 있는 백엔드 API를 구현한다. 스크립트 실행 로그 파일을 읽거나 기존 로그 소스에서 데이터를 제공한다.

## Completion Criteria
- GET /api/tasks/[id]/logs 엔드포인트가 구현된다
- 태스크 ID에 해당하는 로그 데이터를 반환한다
- 로그 파일이 없거나 태스크가 없을 경우 적절한 에러 응답을 반환한다
- 응답 형식은 [{timestamp, level, message}] 배열이다

## 완료 조건

- `src/frontend/src/app/api/tasks/[id]/logs/route.ts` 파일 생성
- GET 요청 시 태스크 ID에 해당하는 로그 파일을 읽어 반환
- 응답 형식: `[{ timestamp: string, level: string, message: string }]` 배열
- 로그 파일이 없을 경우 404 응답 반환
- 태스크 ID가 유효하지 않을 경우 400 응답 반환
- 로그 소스 경로는 기존 스크립트 실행 로그 디렉토리 기준으로 탐색
