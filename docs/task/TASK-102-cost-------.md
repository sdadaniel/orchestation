---
id: TASK-102
title: cost 페이지에 시간별 누적 비용 추이 차트 추가
status: pending
priority: medium
sprint:
depends_on: []
branch: task/TASK-102-cost-------
worktree: ../repo-wt-TASK-102
role: general
reviewer_role: reviewer-general
---

# TASK-102: cost 페이지에 시간별 누적 비용 추이 차트 추가

## 원본 요청

- Request: REQ-038
- 제목: 시간별 누적 비용 추이 시각화
- 내용: 숫자 테이블만 있고 시간에 따른 비용 증가 추이를 시각적으로 확인할 수 없다. 간단한 누적 비용 차트(라인 또는 바)를 추가하여 비용 추이를 한눈에 볼 수 있게 한다.

## 완료 조건

- 기존 cost 테이블 위 또는 아래에 누적 비용 차트(라인 또는 바) 컴포넌트를 추가한다
- X축: 시간(타임스탬프), Y축: 누적 비용($)
- 기존 cost 테이블 데이터를 재사용하여 차트 데이터를 생성한다
- Recharts 또는 동등한 라이브러리를 사용하거나, 이미 사용 중인 차트 라이브러리를 활용한다
- 차트는 시간순으로 정렬된 누적 비용을 표시한다
- 기존 cost 페이지 레이아웃과 일관된 스타일을 유지한다
