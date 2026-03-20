---
id: PLAN-001
title: 오케스트레이션 대시보드
status: in_progress
sprints:
  - SPRINT-001
  - SPRINT-002
  - SPRINT-003
  - SPRINT-004
---

# Plan: 오케스트레이션 대시보드

## 목표

docs/ 하위 문서를 파싱하여 프로젝트 현황을 웹 대시보드로 시각화

## 단계

1. **프로젝트 셋업** — Next.js 프로젝트 초기화, 대시보드 레이아웃 (사이드바 + 탭 구조)
2. **데이터 레이어** — docs/task/*.md frontmatter 파싱 API
3. **Task 관계도** — 그래프 시각화 (노드 + 엣지 + 상태 색상)
4. **웹 터미널** — xterm.js + WebSocket + node-pty 기반 브라우저 내 터미널, 사이드바 라우트 전환
5. (향후) Sprint 뷰
6. (향후) Plan 뷰
