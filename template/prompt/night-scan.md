코드베이스를 스캔하여 이슈 1개를 찾고 아래 형식으로만 출력하세요.

{{type_prompt}}
{{instructions}}

규칙:
- 경미한 수정만 (로직 변경 금지)
- scope는 실제 존재하는 파일 경로만
- 설명이나 인사말 없이 아래 형식만 출력

이슈를 찾지 못했으면 NOT_FOUND 한 단어만 출력하세요.

이슈를 찾았으면 반드시 아래 형식 그대로 출력하세요. --- 로 시작하고 --- 로 끝나는 frontmatter 블록이 반드시 있어야 합니다:

---
id: {{task_id}}
title: 여기에-제목
status: pending
priority: medium
mode: night
created: {{date}}
updated: {{date}}
depends_on: []
scope:
  - 파일/경로
---
여기에 태스크 설명을 작성합니다.

## Completion Criteria
- 완료 조건

위 형식 외의 텍스트는 절대 출력하지 마세요. frontmatter 블록(---)으로 시작해야 합니다.
