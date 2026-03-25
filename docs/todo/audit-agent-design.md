# Audit Agent 설계 문서

## 목적

코드베이스를 주기적으로 크롤링하며 자잘한 버그(UI 상태 불일치, race condition, 로직 오류 등)를 자동 발견하고 TASK로 등록하는 백그라운드 에이전트.

현재 파이프라인(`auto-improve → orchestrate → run-worker`)의 리뷰 단계를 통과한 코드에서도 버그가 남는 문제를 해결하기 위함.

---

## 구조 개요

```
[audit.sh] ──(120초 간격 루프)──▶ 파일 수집 → Claude 분석 → TASK 파일 생성
    │
    ├── 대상: src/frontend/src/**/*.{ts,tsx} + scripts/*.sh
    ├── 분석: claude --print --model claude-sonnet-4-6
    ├── 출력: docs/task/TASK-NNN-*.md (status: pending)
    └── 중복 방지: 기존 TASK 제목과 비교
```

## 컴포넌트별 상세

### 1. `scripts/audit.sh`

auto-improve.sh 패턴 복제. 핵심 흐름:

```bash
while true:
  check_stop_flag (.audit-stop)

  # 1) 대상 파일 수집
  #    - src/frontend/src/ 아래 .ts, .tsx
  #    - scripts/ 아래 .sh
  #    - 최근 변경된 파일 우선 (git diff --name-only HEAD~5)

  # 2) 배치로 묶어서 Claude에 전달
  #    - 파일 내용 + 기존 TASK 목록(중복 방지용)
  #    - auditor role 프롬프트 사용

  # 3) Claude 응답 파싱
  #    - JSON 배열: [{title, priority, description, scope}]
  #    - 각 이슈마다 TASK-NNN.md 생성

  # 4) 다음 TASK ID 계산
  #    - docs/task/TASK-*.md 중 최대 번호 + 1

  sleep 120
done
```

**정지 메커니즘:** `.audit-stop` 플래그 파일 (auto-improve와 동일)

**고려사항:**
- 한 번에 보내는 파일 크기 제한 필요 (토큰 초과 방지)
- 최근 변경 파일 우선 → 전체 스캔은 가끔씩만
- Claude 호출 비용: 한 사이클당 sonnet 1회 호출 기준 ~$0.01-0.05

### 2. `docs/roles/auditor.md`

감사 전용 role 프롬프트:

```
당신은 코드 감사(audit) 전문가입니다.
주어진 코드에서 다음을 찾으세요:

- UI 상태 불일치 (status와 실제 렌더링 불일치, 버튼 표시 오류)
- Race condition (비동기 호출 순서, cleanup 누락)
- 잘못된 조건문/필터링 로직
- 에러 핸들링 누락 (catch 없는 fetch, 빈 catch 블록)
- 쉘 스크립트: 변수 quoting 누락, pipe 에러 처리, set -e 누락

각 이슈를 다음 JSON 배열 형식으로 출력:
[{"title": "...", "priority": "high|medium|low", "description": "...", "scope": ["file1.ts", "file2.ts"]}]

이미 알려진 이슈 목록이 제공되면 중복을 피하세요.
이슈가 없으면 빈 배열 []을 출력하세요.
```

### 3. 프론트엔드 연동 (선택)

auto-improve와 동일한 패턴으로 UI 제어 가능:

| 파일 | 역할 |
|------|------|
| `src/frontend/src/lib/audit-manager.ts` | singleton, spawn/stop/state 관리 |
| `src/frontend/src/app/api/audit/run/route.ts` | POST - 시작 |
| `src/frontend/src/app/api/audit/stop/route.ts` | POST - 중지 |
| `src/frontend/src/app/api/audit/status/route.ts` | GET - 상태 조회 |
| `src/frontend/src/components/AuditControl.tsx` | Run/Stop 버튼 |

Tasks 페이지 헤더에 AutoImproveControl 옆에 배치.

### 4. 생성되는 TASK 파일 예시

```yaml
---
id: TASK-111
title: AutoImproveControl - running 상태에서 polling 중단 시 버튼 불일치
status: pending
priority: medium
role: general
reviewer_role: reviewer-general
scope:
  - src/frontend/src/components/AutoImproveControl.tsx
  - src/frontend/src/hooks/useMonitor.ts
---

## Problem
AutoImproveControl에서 status polling이 실패하면 UI가 "running" 상태에
고정되어 Stop 버튼만 표시됨. 실제로는 프로세스가 종료된 상태.

## Completion Criteria
- polling 실패 시 status를 idle로 fallback
- 연속 N회 실패 시 에러 표시
```

---

## 비용 추정

| 항목 | 예상 |
|------|------|
| 사이클당 Claude 호출 | 1회 (sonnet) |
| 입력 토큰 | ~5,000-20,000 (파일 크기에 따라) |
| 사이클당 비용 | ~$0.01-0.05 |
| 하루 (120초 간격, 8시간) | ~$2.4-12 |

비용 절감 방안:
- 변경 없는 파일은 스킵 (git status 기반)
- 간격을 5-10분으로 늘리기
- haiku 모델 사용 (단순 체크용)

---

## 우선순위

1. `scripts/audit.sh` + `docs/roles/auditor.md` (핵심 — 이것만으로도 CLI에서 수동 실행 가능)
2. 프론트엔드 연동 (AuditManager + API + UI 버튼)
3. 파이프라인 통합 (auto-improve.sh에서 audit도 함께 실행)
