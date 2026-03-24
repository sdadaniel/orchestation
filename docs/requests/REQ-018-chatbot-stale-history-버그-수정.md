---
id: REQ-018
title: ChatBot stale history 버그 수정
status: done
priority: high
created: 2026-03-24
---
ChatBot 컴포넌트에서 activeSession?.messages가 setSessions 비동기 업데이트 전의 stale 값을 참조하여 /api/chat에 빈 history가 전송되는 버그 수정.

## 문제
- `components/ChatBot.tsx`에서 API 호출 시 `activeSession?.messages`가 아직 갱신되지 않은 이전 state를 참조
- 대화 컨텍스트가 유실되어 Claude가 이전 대화를 모르는 상태로 응답

## Completion Criteria
- API 호출 시점에 최신 messages 배열이 항상 전달된다
- useRef 또는 functional setState 패턴으로 stale closure 문제 해소
