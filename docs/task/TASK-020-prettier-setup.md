---
id: TASK-020
title: Prettier 포매터 설정
sprint: SPRINT-004
status: done
priority: medium
depends_on: []
blocks: []
parallel_with:
  - TASK-021
role: frontend-dev
branch: task/TASK-020-prettier-setup
worktree: ../repo-wt-TASK-020
reviewer_role: reviewer-general
affected_files:
  - src/frontend/.prettierrc
  - src/frontend/.prettierignore
  - src/frontend/package.json
  - src/frontend/src/
---

## 목표

프로젝트에 Prettier를 도입하여 코드 스타일을 통일한다.

## 무엇을

- `src/frontend/.prettierrc` — Prettier 설정 파일 (NEW)
- `src/frontend/.prettierignore` — 포맷 제외 패턴 (NEW)
- `src/frontend/package.json` — prettier 패키지 + format 스크립트 추가 (MODIFY)

## 어떻게

1. **패키지 설치**: `yarn add -D prettier`
2. **`.prettierrc`** 생성:
   ```json
   {
     "semi": true,
     "singleQuote": false,
     "tabWidth": 2,
     "trailingComma": "all",
     "printWidth": 80
   }
   ```
   - 기존 코드 스타일(double quote, semi, 2-space indent)과 일치시킨다
3. **`.prettierignore`** 생성:
   ```
   node_modules
   .next
   dist
   ```
4. **package.json 스크립트** 추가:
   ```json
   "format": "prettier --write 'src/**/*.{ts,tsx,js,jsx,json,css}'",
   "format:check": "prettier --check 'src/**/*.{ts,tsx,js,jsx,json,css}'"
   ```
5. **기존 코드 포맷팅**: `yarn format` 실행하여 전체 코드 정리

## 입출력

- 입력: 기존 소스 코드
- 출력: Prettier 규칙에 맞게 포맷팅된 코드 + 설정 파일

## 완료 조건

- `yarn format:check` 실행 시 모든 파일이 통과 (exit 0)
- 기존 코드의 동작이 변경되지 않음 (포맷팅만 적용)
- `.prettierrc`, `.prettierignore` 파일이 존재
