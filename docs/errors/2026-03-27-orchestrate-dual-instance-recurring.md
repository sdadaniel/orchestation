# orchestrate.sh 이중 실행 반복 발생 (2026-03-27)

## 요약
orchestrate.sh가 2개 인스턴스로 중복 실행되는 문제가 같은 날 2회 발생. lock 메커니즘이 이중 실행을 방지하지 못함.

## 발생 이력

### 1차 (14:02)
- PID 91249 (14:02) + PID 45861 (14:07)
- TASK-252 done인데 UI에서 in_progress로 표시, TASK-257 실행 안 됨

### 2차 (16:25)
- PID 37435 (15:22) + PID 95299 (16:25)
- 수동으로 kill하여 해결

## 근본 원인

orchestrate.sh의 lock 메커니즘(`/tmp/orchestrate.lock` mkdir 기반)이 다음 상황에서 실패:

1. **UI에서 Run 버튼을 여러 번 클릭** — 각 클릭이 별도 orchestrate.sh를 spawn
2. **이전 인스턴스의 lock이 stale 상태** — 프로세스가 비정상 종료되면 lock 디렉토리가 남아있고, 다음 인스턴스가 stale 감지 후 lock을 제거하고 진입. 하지만 그 사이에 또 다른 인스턴스가 동시에 같은 판단을 내림 (TOCTOU)
3. **서버 재시작 시 zombie cleanup이 lock을 제거** — orchestrationManager의 cleanupZombies()가 stale lock을 지우면서 새 인스턴스가 진입 가능

## lock 코드 (현재)
```bash
LOCK_DIR="/tmp/orchestrate.lock"
mkdir "$LOCK_DIR" 2>/dev/null || { echo "❌ lock 획득 실패"; exit 1; }
```

### 문제점
- `mkdir`은 atomic하지만, stale lock 감지→삭제→재획득이 atomic하지 않음
- PID 파일 체크 후 lock 삭제와 mkdir 사이에 다른 프로세스가 끼어들 수 있음
- UI에서 orchestrate를 실행할 때 이전 인스턴스 종료를 기다리지 않음

## 영향
- 같은 태스크를 2번 dispatch → signal 이중 처리 → 상태 꼬임
- RUNNING 배열이 인스턴스마다 달라서 슬롯 관리 불일치
- 사용자에게 태스크 상태가 불일치하게 보임

## 개선안

### 1. UI에서 중복 실행 방지 (즉시)
- `POST /api/orchestrate/run` 호출 전에 이미 실행 중인지 체크
- 이미 체크하고 있지만 (`orchestrationManager.isRunning()`), 이게 실제 프로세스 상태와 동기화 안 됨
- **프로세스 PID 기반으로 실제 생존 여부 확인** 후 실행 허용

### 2. lock을 PID + flock 기반으로 강화
```bash
LOCK_FILE="/tmp/orchestrate.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "❌ 이미 실행 중"
  exit 1
fi
echo $$ > "$LOCK_FILE"
# 프로세스 종료 시 flock 자동 해제
```
단, macOS에는 flock이 없으므로 `ln -s` symlink 방식 사용 (설계 문서 Round 4 합의)

### 3. orchestrate.sh 시작 시 기존 인스턴스 강제 종료
```bash
# 시작 시 기존 orchestrate.sh 프로세스 찾아서 kill
existing=$(pgrep -f "orchestrate.sh" | grep -v $$)
if [ -n "$existing" ]; then
  echo "⚠️ 기존 인스턴스 종료: $existing"
  kill $existing 2>/dev/null
  sleep 1
fi
```
가장 단순하고 확실한 방법. 항상 최신 인스턴스만 살아남음.

## 우선순위
| 순서 | 개선안 | 효과 | 난이도 |
|------|--------|------|--------|
| 1 | 시작 시 기존 인스턴스 kill | 이중 실행 원천 차단 | 낮음 |
| 2 | UI 중복 실행 방지 강화 | 사용자 실수 방지 | 낮음 |
| 3 | lock을 symlink 기반으로 | TOCTOU 해소 | 중간 |
