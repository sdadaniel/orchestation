---
id: REQ-033
title: Slug 길이 제한 추가
status: done
priority: low
created: 2026-03-24
---
requests API에서 slug 생성 시 길이 제한이 없어 극단적으로 긴 파일명이 생성될 수 있음.

## 문제
- `api/requests/route.ts:61-64`
- 사용자가 매우 긴 제목을 입력하면 파일시스템 제한(255자) 초과 가능

## Completion Criteria
- slug를 50자 이내로 truncate
- 파일명 총 길이가 OS 제한 내에 있도록 보장
