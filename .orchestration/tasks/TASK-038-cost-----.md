---
id: TASK-038
title: cost 메뉴에 사용 모델명 표시 추가
status: done
priority: medium
sprint:
depends_on: []
branch: task/TASK-038-cost-----
worktree: ../repo-wt-TASK-038
role: general
reviewer_role: reviewer-general
---

# TASK-038: cost 메뉴에 사용 모델명 표시 추가

## 원본 요청

- Request: REQ-005
- 제목: cost 메뉴
- 내용: 여기에 어떤 모델 사용했는지도 적어줘.

## 완료 조건

- `run-task.sh`, `run-review.sh`에서 `claude` CLI JSON 응답의 모델명 필드를 추출해 `token-usage.log`에 기록
- `cost-parser.ts`의 로그 파싱 정규식 및 `CostEntry` 인터페이스에 `model` 필드 추가
- `CostTable.tsx`에 Model 컬럼 추가 (task/review 행에 모델명 표시)
- `TaskCostSummary`에 모델명 집계 포함 (복수 모델 사용 시 쉼표 구분)
