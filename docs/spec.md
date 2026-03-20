# 프롬프트 성능 비교 테스트 스펙

## 목표

동일한 PRD(URL 단축 서비스)를 서로 다른 프롬프트로 구현하여 성능을 비교한다.

## 디렉토리 구조

```
src/prompts/
  prd1.md          # 프롬프트 1
  prd1/            # 프롬프트 1 결과
    result.json
    stderr.log
  prd2.md          # 프롬프트 2
  prd2/            # 프롬프트 2 결과
    result.json
    stderr.log
```
