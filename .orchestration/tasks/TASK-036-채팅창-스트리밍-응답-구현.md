---
id: TASK-036
title: 채팅창 스트리밍 응답 구현
status: done
priority: medium
sprint:
depends_on: []
branch: task/TASK-036-채팅창-스트리밍-응답-구현
worktree: ../repo-wt-TASK-036
role: general
reviewer_role: reviewer-general
---

# TASK-036: 채팅창 스트리밍 응답 구현

## 원본 요청

- Request: REQ-002
- 제목: 채팅창
- 내용: 이거 스트리밍형식으로 나올 수 있게 해줘.

## 완료 조건

- `src/frontend/src/app/api/chat/route.ts`: `execSync` 방식을 제거하고 Claude CLI의 스트리밍 출력을 `ReadableStream`으로 반환하도록 변경 (`--output-format stream-json` 또는 `text` 옵션 활용)
- `src/frontend/src/components/ChatBot.tsx`: `res.json()` 방식 대신 `res.body` ReadableStream을 청크 단위로 읽어 어시스턴트 메시지 content를 점진적으로 업데이트
- 스트리밍 중 입력창 비활성화(전송 버튼 disabled) 처리
- 스트리밍 완료 후 메시지가 세션에 정상 저장될 것
- 기존 비스트리밍 응답 형식과의 하위 호환성 불필요 (완전 교체)
