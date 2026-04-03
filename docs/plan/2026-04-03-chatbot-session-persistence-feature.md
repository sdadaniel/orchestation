# ChatBot 세션 영속화 기능 설계

## 배경

현재 `ChatBot` 컴포넌트(`src/frontend/src/components/ChatBot.tsx`)는 React state로만 세션을 관리한다.
페이지 새로고침이나 브라우저 탭 닫기 시 모든 대화 내역이 소멸되어 사용자 경험이 저하된다.

## 목표

- 대화 세션을 `localStorage`에 영속화하여 새로고침 후에도 복원
- 기존 ChatBot UI/UX 변경 최소화

## 설계

### 저장 구조

```typescript
// localStorage key
const STORAGE_KEY = "chatbot-sessions";

// 저장 형식
interface StoredData {
  sessions: Session[];
  activeSessionId: string | null;
  version: number; // 스키마 버전 (마이그레이션용)
}
```

### 핵심 동작

1. **자동 저장**: `sessions` state가 변경될 때마다 `localStorage`에 동기화
2. **초기 로드**: 컴포넌트 마운트 시 `localStorage`에서 세션 복원
3. **세션 삭제**: UI에서 삭제 시 `localStorage`에서도 제거
4. **용량 관리**: 저장 실패(QuotaExceeded) 시 가장 오래된 세션부터 삭제 후 재시도

### 구현 방향

```typescript
// useEffect로 저장
useEffect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessions,
      activeSessionId: activeSession?.id ?? null,
      version: 1,
    }));
  } catch {
    // QuotaExceeded 대응: 오래된 세션 정리
  }
}, [sessions, activeSession]);

// 초기 로드
const [sessions, setSessions] = useState<Session[]>(() => {
  if (typeof window === "undefined") return [createSession()];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as StoredData;
      return data.sessions.length > 0 ? data.sessions : [createSession()];
    }
  } catch {
    // 파싱 실패 시 새 세션
  }
  return [createSession()];
});
```

### 제약 사항

- `localStorage` 용량 제한(약 5MB)으로 인해 대량 세션 저장 시 정리 필요
- SSR 환경에서 `window` 객체 접근 불가 → `typeof window` 가드 필수
- 민감 정보(API 키 등)가 대화에 포함될 수 있으므로 보안 고려 필요

## 영향 범위

- `src/frontend/src/components/ChatBot.tsx` — state 초기화 및 저장 로직 추가
- 기존 컴포넌트 구조 변경 없음 (state 관리 레이어만 추가)

## 우선순위

Medium — 사용성 개선이나 핵심 기능 차단 요소는 아님
