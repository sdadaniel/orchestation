---
id: TASK-084
title: requests API slug 길이 50자 제한 추가
status: done
priority: low
sprint:
depends_on: []
branch: task/TASK-084-requests-api-slug--50--
worktree: ../repo-wt-TASK-084
role: general
reviewer_role: reviewer-general
---

# TASK-084: requests API slug 길이 50자 제한 추가

## 원본 요청

- Request: REQ-033
- 제목: Slug 길이 제한 추가
- 내용: requests API에서 slug 생성 시 길이 제한이 없어 극단적으로 긴 파일명이 생성될 수 있음.

## 문제
- `api/requests/route.ts:61-64`
- 사용자가 매우 긴 제목을 입력하면 파일시스템 제한(255자) 초과 가능

## Completion Criteria
- slug를 50자 이내로 truncate
- 파일명 총 길이가 OS 제한 내에 있도록 보장

## 완료 조건

- `src/frontend/src/app/api/requests/route.ts` 61-64행 slug 생성 로직에 50자 truncate 적용
- truncate 후 trailing hyphen 제거 (예: `some-long-slug-` → `some-long-slug`)
- 파일명 전체 길이(prefix + slug + extension)가 255자 이내임을 확인

## 실패 사유 (2026-03-24 17:57)

Not logged in · Please run /login

## 실패 사유 (2026-03-24 18:34)

Not logged in · Please run /login

## 실패 사유 (2026-03-24 18:36)

Not logged in · Please run /login
