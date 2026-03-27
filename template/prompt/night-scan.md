코드베이스를 스캔하여 이슈 1개를 찾고 아래 형식으로만 출력하세요.

{{type_prompt}}
{{instructions}}

규칙:
- 경미한 수정만 (로직 변경 금지)
- scope는 실제 존재하는 파일 경로만
- 설명이나 인사말 없이 아래 형식만 출력

결과를 **반드시 아래 JSON 형식으로만** 출력하세요. 다른 텍스트 없이 JSON만:

이슈를 찾지 못했으면:
```json
{"found": false}
```

이슈를 찾았으면:
```json
{
  "found": true,
  "task": {
    "id": "{{task_id}}",
    "title": "여기에 제목",
    "priority": "medium",
    "mode": "night",
    "created": "{{date}}",
    "scope": ["파일/경로"],
    "description": "태스크 설명",
    "criteria": ["완료 조건 1", "완료 조건 2"]
  }
}
```
