---
id: NOTICE-147
title: TASK-289 거절
type: warning
read: true
created: 2026-03-30
updated: 2026-03-31
---
**TASK-289:** globals.css 미사용 Board/Timeline CSS 클래스 제거\n\n거절: CSS 클래스 삭제는 이미 완료되어 있습니다. globals.css에 미사용 19개 CSS 클래스(`.board-container`, `.timeline-row` 등)가 모두 제거되었고, `.board-card` 등 사용 중인 클래스는 유지되어 있습니다. 프론트엔드 빌드 실패는 main 브랜치에서도 발생하는 기존 문제(`_global-error.tsx` React Context 에러)이므로, 이 task의 scope(globals.css)를 벗어나 있습니다.
