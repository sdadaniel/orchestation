---
id: TASK-339
title: ChatBot-Math.random-crypto.randomUUID-교체-및-신규-기능-제안
status: done
branch: task/task-339
worktree: ../repo-wt-task-339
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-03 02:43
depends_on: []
scope:
  - src/frontend/src/components/ChatBot.tsx
  - docs/plan/2026-04-03-chatbot-session-persistence-feature.md
---
## 코드 스타일 이슈

`src/frontend/src/components/ChatBot.tsx:21-23`에서 `Math.random().toString(36).slice(2, 10)`으로 ID를 생성하고 있다.
`Math.random()`은 암호학적으로 안전하지 않으며 충돌 가능성이 있다.
`crypto.randomUUID()`로 교체하여 표준적이고 안전한 ID 생성으로 변경한다.

### 수정 내용
```typescript
// Before
function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// After
function generateId() {
  return crypto.randomUUID();
}
```

## 신규 기능 제안: ChatBot 세션 영속화

현재 ChatBot 세션은 메모리(state)에만 존재하여 페이지 새로고침 시 대화 내역이 소멸된다.
`localStorage`를 활용한 세션 영속화 기능을 제안한다.

### 제안 상세
- 세션 목록과 메시지를 `localStorage`에 자동 저장
- 페이지 로드 시 저장된 세션 복원
- 세션 삭제 시 `localStorage`에서도 제거
- 저장 용량 초과 시 가장 오래된 세션부터 자동 정리

### 문서화
`docs/plan/2026-04-03-chatbot-session-persistence-feature.md`에 상세 설계 문서를 작성한다.

## Completion Criteria
- [ ] `generateId()`가 `crypto.randomUUID()`를 사용하도록 변경
- [ ] 기존 동작에 영향 없음 (ID 형식만 변경, 로직 변경 없음)
- [ ] 신규 기능 제안 문서 `docs/plan/2026-04-03-chatbot-session-persistence-feature.md` 작성 완료
