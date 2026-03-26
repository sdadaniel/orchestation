---
id: TASK-197
title: Notice 렌더링 개선 — 줄바꿈, 마크다운, 내용 풍부화
status: done
branch: task/task-197
worktree: ../repo-wt-task-197
priority: high
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/app/notices/page.tsx
  - src/frontend/src/components/MarkdownContent.tsx
  - scripts/orchestrate.sh
  - scripts/night-worker.sh
  - scripts/lib/merge-resolver.sh
---

## 현상
- Notice 내용에 \n이 텍스트 그대로 표시됨 (줄바꿈 안 됨)
- Night Worker 완료 Notice가 한 줄로 뭉쳐서 읽기 힘듦
- 내용이 빈약함 (생성 태스크 0개, 비용만 표시)

## 수정 방향

### 1. Notice 렌더링 (프론트)
- Notice content를 MarkdownContent로 렌더링 (마크다운 지원)
- \n을 실제 줄바꿈으로 변환
- 타입별(info/warning/error) 시각 구분 강화

### 2. Notice 내용 풍부화 (스크립트)
- orchestrate.sh 완료 Notice: 완료된 태스크 목록, 실패 목록, 총 비용, 소요 시간
- Night Worker 완료 Notice: 생성 태스크 목록 (ID + 제목), 스캔 유형별 결과, 비용 breakdown
- 머지 충돌 Notice: 충돌 파일 목록, 해결 방법, diff 요약
- Notice content에 마크다운 테이블, 리스트 사용

### 3. Notice 레이아웃
- 제목 + 타입 뱃지 + 날짜 헤더
- 내용은 카드 안에 마크다운 렌더링
- 읽음/안읽음 시각 구분

## Completion Criteria
- \n이 실제 줄바꿈으로 렌더링
- Night Worker Notice에 태스크 목록 포함
- 마크다운 (테이블, 리스트, 코드블록) 정상 표시
- 가독성 대폭 개선
