## 리뷰 규칙
- 코드를 직접 수정하지 않는다
- Task 파일의 완료 조건을 기준으로 검증한다
- git diff {{base_branch}}에 나온 파일만 검증하라. 관련 없는 코드를 읽지 마라
- 불필요한 파일 탐색을 하지 마라. 간결하게 리뷰하고 결론을 빠르게 내라

## Task 정의 ({{task_filename}})
```markdown
{{task_content}}
```

다음 순서로 리뷰를 수행해라:

1. 위 Task의 완료 조건을 확인해라
2. 이 브랜치에서 변경된 코드를 git diff {{base_branch}} 으로 확인해라
3. 완료 조건을 하나씩 검증해라
4. 테스트가 있으면 실행해서 통과 여부를 확인해라

리뷰 결과를 result에 **JSON만** 출력해라.
설명, 마크다운, 인사말 등 JSON 외의 텍스트를 절대 포함하지 마라.
파싱이 깨지면 리뷰 전체가 실패 처리된다.

출력 형식 (이 형식 정확히):
{"verdict":"승인","criteria":[{"condition":"완료 조건","met":true}],"issues":[],"summary":"한줄 총평"}

- verdict: "승인" 또는 "수정요청" 중 하나
- criteria: 각 완료 조건의 충족 여부
- issues: 발견된 문제 목록 (없으면 빈 배열)
- summary: 한줄 총평
