# Feature Proposal: noUnusedLocals tsconfig 옵션 활성화

## 배경

현재 `tsconfig.json`에 `strict: true`가 설정되어 있으나, `noUnusedLocals`와 `noUnusedParameters`는 활성화되어 있지 않다. 이로 인해 선언 후 사용되지 않는 변수가 코드에 잔존하며, TASK-310(미사용 import/변수 정리) 완료 후에도 새로운 미사용 변수가 유입될 수 있다.

## 현황 분석

`npx tsc --noEmit --strict --noUnusedLocals --noUnusedParameters` 실행 결과, 비테스트 파일에서 1건의 미사용 변수 발견:

| 파일 | 라인 | 내용 |
|------|------|------|
| `src/app/tasks/[id]/page.tsx` | 154 | `data` 변수 선언 후 미사용 |

## 제안

### Phase 1: 기존 미사용 변수 정리 (TASK-331)
- 현재 발견된 1건 수정

### Phase 2: tsconfig.json에 옵션 추가
```json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 기대 효과
- 미사용 변수/파라미터가 커밋 전에 tsc에서 차단됨
- 코드 정리 태스크(TASK-310 등)의 반복 필요성 제거
- 데드코드 축적 방지

### 리스크
- `noUnusedParameters`는 콜백 시그니처에서 `_` prefix 강제 — 기존 코드 일부 수정 필요
- 점진적 적용을 위해 Phase 1 완료 후 Phase 2 진행 권장

## 결정 필요 사항
- `noUnusedParameters` 동시 활성화 여부 (콜백 파라미터 수정 범위 확인 필요)
