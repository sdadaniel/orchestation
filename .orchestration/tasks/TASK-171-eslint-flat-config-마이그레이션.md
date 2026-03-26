---
id: TASK-171
title: ESLint flat config 마이그레이션 (v10 대응)
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/eslint.config.mjs
  - src/frontend/package.json
---

## 문제

`eslint` v10.0.3이 devDependencies에 설치되어 있고 `eslint-config-next`도 있지만,
`eslint.config.js` (flat config) 파일이 없어 **ESLint가 전혀 실행되지 않는 상태**이다.

현재 `package.json`의 `eslintConfig` 필드에 `extends: ["plugin:storybook/recommended"]`가 있지만,
ESLint v9+ 부터 flat config(`eslint.config.js`)만 인식하므로 이 설정은 무시된다.

```
$ npx eslint src/
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```

## 작업 내용

1. `src/frontend/eslint.config.mjs` 생성
   - `eslint-config-next` 기반 flat config 설정
   - `plugin:storybook/recommended` 규칙 포함
   - `@typescript-eslint/no-explicit-any` warn 수준 설정
2. `package.json`에서 레거시 `eslintConfig` 필드 제거
3. `npx eslint src/` 실행하여 정상 동작 확인

## 주의사항

- 로직 변경 없음, 설정 파일만 추가/수정
- 기존 `eslint-disable` 주석은 그대로 유지 (별도 태스크에서 처리)
- ESLint 자동 수정(`--fix`)은 이 태스크에서 실행하지 않음

## Completion Criteria

- `npx eslint src/` 명령이 에러 없이 실행됨 (warning은 허용)
- flat config에 Next.js + Storybook + TypeScript 규칙이 포함됨
- `package.json`에서 레거시 `eslintConfig` 필드가 제거됨
