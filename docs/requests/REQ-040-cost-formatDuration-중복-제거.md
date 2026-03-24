---
id: REQ-040
title: CostTable/RunHistory의 formatDuration 중복 제거
status: done
priority: low
created: 2026-03-24
updated: 2026-03-24
---
CostTable.tsx와 RunHistory.tsx에 동일한 formatDuration 함수가 중복 정의되어 있다. 공통 유틸로 추출하여 중복을 제거한다.
