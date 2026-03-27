---
id: TASK-259
title: Task Graph - HTML/CSS 기반 DAG 뷰 추가
status: done
branch: task/task-259
worktree: ../repo-wt-task-259
priority: medium
role: frontend-dev
scope:
  - src/frontend/src/components/**
  - src/frontend/src/app/tasks/**
created: 2026-03-27 16:06:01
updated: 2026-03-27 16:06:01
---
DAGCanvas.tsx의 SVG 캔버스 렌더링과 동일한 시각적 결과물을 HTML/CSS div 기반으로 구현한다. 기존 SVG 캔버스는 그대로 유지하고, 그 위(z-index 또는 탭 방식)에 새 구현체를 오버레이한다. 동일한 computeDAGLayout 로직을 재사용하고, 노드는 position:absolute div, 엣지는 SVG overlay로 렌더링한다. 패닝/줌 인터랙션도 동일하게 구현한다.

## Completion Criteria
- 기존 DAGCanvas.tsx SVG 캔버스가 삭제되지 않고 유지됨
- 새 컴포넌트(DAGCanvasCode 등)가 동일한 레이아웃 로직(computeDAGLayout)을 재사용함
- 노드가 position:absolute div로 렌더링되며 동일한 스타일(border color, status dot, priority badge 등) 적용
- 엣지가 SVG로 동일한 bezier 커브와 화살표 marker로 표시됨
- 섹션 그룹 박스(dashed rect)와 ghost box가 동일하게 표현됨
- pan/zoom 인터랙션이 동일하게 동작함
- tasks/page.tsx에서 두 구현체를 나란히 또는 전환 가능하게 렌더링함
