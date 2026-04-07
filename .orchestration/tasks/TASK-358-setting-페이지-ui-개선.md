---
id: TASK-358
title: setting 페이지 UI 개선
status: done
branch: task/task-358
worktree: ../repo-wt-task-358
priority: medium
created: 2026-04-07 10:30
updated: 2026-04-07 03:50
depends_on: []
scope:
  - src/frontend/src/app/settings/page.tsx
---

Settings 페이지의 UI를 개선한다.

## 개선 항목

1. **섹션 구분 강화**: API, Source Paths, Configuration 섹션을 Label size="section"으로 명확히 구분
2. **API Key 입력 필드 개선**: show/hide 토글 버튼 추가 (Eye/EyeOff 아이콘)
3. **설명 텍스트 보강**: 각 설정의 용도를 더 명확하게 설명
4. **Save 버튼**: Button 컴포넌트 사용 (raw button 태그 대신)
5. **baseBranch 설정 필드 추가**: 현재 config에는 baseBranch가 있지만 UI에 노출되지 않음

## Completion Criteria
- raw `<button>` 태그 대신 `Button` 컴포넌트 사용
- API Key에 show/hide 토글이 동작
- baseBranch 설정 필드가 UI에 표시됨
- 모든 섹션이 Label size="section"으로 구분됨
