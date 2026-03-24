---
id: REQ-034
title: next.config 보안 헤더 설정
status: done
priority: low
created: 2026-03-24
---
next.config.ts가 빈 설정으로 security headers와 native module(node-pty) webpack 설정이 부재.

## 문제
- `next.config.ts` — 빈 NextConfig 객체
- 보안 헤더(X-Frame-Options, CSP 등) 미설정
- node-pty 같은 native module의 webpack externals 설정 없음

## Completion Criteria
- 기본 보안 헤더 추가
- native module이 있다면 webpack externals 설정
