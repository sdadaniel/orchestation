---
id: TASK-106
title: Cost Summary에 모델별 비용 집계 추가
status: done
priority: medium
sort_order: 3
sprint:
depends_on: [TASK-105]
branch: task/TASK-106-cost-summary----
worktree: ../repo-wt-TASK-106
role: general
reviewer_role: reviewer-general
---

# TASK-106: Cost Summary에 모델별 비용 집계 추가

## 원본 요청

- Request: REQ-037
- 제목: Cost Summary에 모델별 비용 집계 추가
- 내용: SummaryCards에 모델별(Haiku vs Opus 등) 비용 집계를 추가한다. 현재 task(haiku)가 $0.9~1.1, review(opus)가 $0.1~0.2로 큰 차이가 있는데 이를 한눈에 볼 수 없다.

## 완료 조건

- cost 데이터에서 모델명(haiku, opus 등)별 비용을 집계하는 로직 추가
- SummaryCards 컴포넌트에 모델별 비용을 표시하는 카드 또는 섹션 추가
- 모델명과 해당 총 비용($X.XX 형식)을 한눈에 비교할 수 있도록 렌더링
- 기존 SummaryCards UI 스타일과 일관성 유지
