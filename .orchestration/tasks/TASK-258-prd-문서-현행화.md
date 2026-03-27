---
id: TASK-258
title: PRD 문서 현행화
status: done
branch: task/task-258
worktree: ../repo-wt-task-258
priority: high
role: prd-architect
scope:
  - docs/**
  - src/frontend/src/**
  - src/backend/**
  - scripts/**
created: 2026-03-27 15:46:08
updated: 2026-03-27 15:46:08
---
현재 프로젝트 코드베이스(백엔드, 프론트엔드, 스크립트 구조)를 분석하여 기존 PRD 문서를 실제 구현 상태에 맞게 업데이트한다. 구현된 기능, 변경된 아키텍처, 삭제된 개념(Request → Task 통일 등)을 반영하고, 미구현/변경된 항목은 명확히 표시한다.

## Completion Criteria
- docs/ 내 PRD 파일이 현재 코드베이스 구조와 일치함
- Request(REQ-*) 개념이 문서에서 제거되고 Task(TASK-*) 기반으로 통일됨
- 구현된 기능과 미구현 기능이 명확히 구분되어 기술됨
- 아키텍처 다이어그램 또는 설명이 실제 디렉토리 구조와 일치함
- TBD 항목이 현재 결정된 내용으로 해소되거나 잔존 TBD로 명시됨
