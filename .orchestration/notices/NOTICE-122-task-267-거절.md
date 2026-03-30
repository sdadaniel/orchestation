---
id: NOTICE-122
title: TASK-267 거절
type: warning
read: false
created: 2026-03-27
updated: 2026-03-27
---
**TASK-267:** requests API route 내 slug 생성 로직 중복 제거\n\n거절: 이미 완료됨. 현재 파일의 167행에서 `parseRequestFile(newPath)`로 기존 `newPath` 변수를 재사용하고 있으며, 인라인 slug 재계산이 제거되어 있습니다.
