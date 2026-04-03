---
id: TASK-339
title: ChatBot-Math.random-crypto.randomUUID-교체-및-신규-기능-제안
status: pending
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-03
depends_on: []
scope:
  - src/frontend/src/components/ChatBot.tsx
  - docs/plan/2026-04-03-chatbot-session-persistence-feature.md
---
## 코드 스타일 이슈

`src/frontend/src/components/ChatBot.tsx:21-23`에서 `Math.random().toString(36).slice(2, 10)`으로 ID를 생성하고 있다.
`Math.random()`은 암호학적으로 안전하지 않으며 충돌 가능성이 있다.
`crypto.randomUUID()`로 교체하여 표준적이고 안전한 ID 생성으로 변경한다.

## 신규 기능 제안: ChatBot 세션 영속화

현재 ChatBot 세션은 메모리(state)에만 존재하여 페이지 새로고침 시 대화 내역이 소멸된다.
`localStorage`를 활용한 세션 영속화 기능을 제안한다.
상세 설계: `docs/plan/2026-04-03-chatbot-session-persistence-feature.md`

## Completion Criteria
- [ ] `generateId()`가 `crypto.randomUUID()`를 사용하도록 변경
- [ ] 기존 동작에 영향 없음 (ID 형식만 변경, 로직 변경 없음)
- [ ] 신규 기능 제안 문서 `docs/plan/2026-04-03-chatbot-session-persistence-feature.md` 작성 완료
