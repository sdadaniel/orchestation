---
id: TASK-153
title: Current 탭 SVG 캔버스를 div 칸반 + SVG overlay로 전환
status: pending
priority: medium
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/DAGCanvas.tsx
  - src/frontend/src/app/tasks/page.tsx
  - src/frontend/src/app/globals.css
---

## 현재 문제
- SVG foreignObject 기반 캔버스 — 줌/패닝 UX 어색, 높이 조절 반복 필요
- 노드가 foreignObject라 CSS 제어 어려움
- 모바일/반응형 대응 어려움

## 변경 방향
SVG 캔버스 전체를 div 칸반 보드 + SVG overlay 구조로 전환

### 노드 (div)
- 섹션별 컬럼: PENDING | IN PROGRESS | DONE | FAILED
- 각 노드는 일반 div (기존 board-card 스타일 재활용)
- 가로 스크롤로 섹션 이동
- 줌/패닝 불필요

### 연결선 (SVG overlay)
- div 위에 absolute position SVG 레이어
- 기존 edge 곡선 로직 재활용 (bezier curve)
- 노드 DOM 위치 기반으로 좌표 계산
- 같은 섹션 내 연결은 오른쪽 우회 곡선 유지

### 기존 기능 유지
- 의존 관계 화살표 (흰색 실선)
- ghost box ("N more")
- 점유 중인 Scope 패널
- 노드 클릭 → 상세 페이지 이동
- hover 시 연결선 강조

## Completion Criteria
- div 칸반 레이아웃으로 노드 표시
- SVG overlay로 의존 관계 연결선 표시
- 줌/패닝 코드 제거
- 기존 기능 모두 정상 동작
- 반응형 가로 스크롤
