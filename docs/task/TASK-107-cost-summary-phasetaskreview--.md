---
id: TASK-107
title: Cost Summary에 phase별(task/review) 비용 비율 표시
status: in_progress
priority: medium
sort_order: 5
sprint:
depends_on: [TASK-106]
branch: task/TASK-107-cost-summary-phasetaskreview--
worktree: ../repo-wt-TASK-107
role: general
reviewer_role: reviewer-general
updated: 2026-03-24 09:22:19
---
# TASK-107: Cost Summary에 phase별(task/review) 비용 비율 표시

## 원본 요청

- Request: REQ-039
- 제목: Cost Summary에 phase별(task/review) 비용 비율 표시
- 내용: SummaryCards에 task vs review phase별 비용 비율을 표시한다. 현재 task가 review의 5~10배 비용인데 이 비율이 보이지 않는다.

## 완료 조건

- cost 데이터에서 phase 필드("task" / "review")를 기준으로 비용을 집계한다
- SummaryCards 컴포넌트에 task phase 비용, review phase 비용, 그리고 각 비율(%)을 표시한다
- 비율은 전체 대비 각 phase의 백분율로 계산한다 (task% + review% = 100%)
- phase 데이터가 없는 항목은 "기타"로 분류하거나 무시한다
- 기존 SummaryCards 레이아웃을 크게 변경하지 않고 새 항목을 추가하는 방식으로 구현한다

## 실패 사유 (2026-03-24 17:57)

Not logged in · Please run /login

## 실패 사유 (2026-03-24 18:22)

Not logged in · Please run /login
