---
id: TASK-092
title: next.config.ts 보안 헤더 및 webpack externals 설정
status: in_progress
priority: low
sprint:
depends_on: []
branch: task/TASK-092-nextconfigts----webpack-extern
worktree: ../repo-wt-TASK-092
role: general
reviewer_role: reviewer-general
---

# TASK-092: next.config.ts 보안 헤더 및 webpack externals 설정

## 원본 요청

- Request: REQ-034
- 제목: next.config 보안 헤더 설정
- 내용: next.config.ts가 빈 설정으로 security headers와 native module(node-pty) webpack 설정이 부재.

## 문제
- `next.config.ts` — 빈 NextConfig 객체
- 보안 헤더(X-Frame-Options, CSP 등) 미설정
- node-pty 같은 native module의 webpack externals 설정 없음

## Completion Criteria
- 기본 보안 헤더 추가
- native module이 있다면 webpack externals 설정

## 완료 조건

- `next.config.ts`에 X-Frame-Options, X-Content-Type-Options, Referrer-Policy 등 기본 보안 헤더 추가
- Content-Security-Policy(CSP) 헤더 기본값 설정
- `node-pty` 등 native module이 실제 사용 중인 경우 webpack `externals` 설정 추가
- 개발/프로덕션 환경 모두에서 헤더가 적용되는지 확인
