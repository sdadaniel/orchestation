/**
 * signal.ts — 원자적 시그널 파일 관리
 * scripts/lib/signal.sh의 Node.js 포팅
 */
import fs from "fs";
import path from "path";

export type SignalSuffix =
  | "task-done"
  | "task-failed"
  | "task-rejected"
  | "review-approved"
  | "review-rejected"
  | "stopped"
  | "stop-request"
  | "start";

const ALL_SIGNAL_SUFFIXES: SignalSuffix[] = [
  "task-done",
  "task-failed",
  "task-rejected",
  "review-approved",
  "review-rejected",
  "stopped",
];

/**
 * 시그널 파일을 원자적으로 생성한다.
 * temp 파일 작성 → rename (같은 파일시스템에서는 원자적)
 */
export function signalCreate(signalDir: string, taskId: string, suffix: SignalSuffix): void {
  fs.mkdirSync(signalDir, { recursive: true });
  const target = path.join(signalDir, `${taskId}-${suffix}`);
  const tmp = `${target}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, `${process.pid}\n`);
  fs.renameSync(tmp, target);
}

/**
 * 태스크에 대한 시그널 존재 여부를 확인한다.
 * 파일을 삭제하지 않음 (비파괴적).
 */
export function signalCheck(signalDir: string, taskId: string): SignalSuffix | null {
  if (!fs.existsSync(signalDir)) return null;

  for (const suffix of ALL_SIGNAL_SUFFIXES) {
    const f = path.join(signalDir, `${taskId}-${suffix}`);
    if (fs.existsSync(f)) return suffix;
  }
  return null;
}

/**
 * 시그널을 소비한다 (확인 + 삭제).
 * mkdir 기반 락으로 레이스 방지.
 */
export function signalConsume(signalDir: string, taskId: string): SignalSuffix | null {
  if (!fs.existsSync(signalDir)) return null;

  const lockDir = path.join(signalDir, `.lock-${taskId}`);
  if (!acquireLock(lockDir, 5000)) return null;

  try {
    for (const suffix of ALL_SIGNAL_SUFFIXES) {
      const f = path.join(signalDir, `${taskId}-${suffix}`);
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch { /* already consumed */ }
        return suffix;
      }
    }
    return null;
  } finally {
    releaseLock(lockDir);
  }
}

/**
 * mkdir 기반 원자적 락 획득
 */
function acquireLock(lockDir: string, timeoutMs: number): boolean {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      fs.mkdirSync(lockDir);
      return true;
    } catch {
      // 10ms 대기 후 재시도
      const waitEnd = Date.now() + 10;
      while (Date.now() < waitEnd) { /* spin */ }
    }
  }
  // 타임아웃: stale 락 정리 시도
  try {
    fs.rmdirSync(lockDir);
    fs.mkdirSync(lockDir);
    return true;
  } catch {
    return false;
  }
}

function releaseLock(lockDir: string): void {
  try {
    fs.rmdirSync(lockDir);
  } catch { /* ignore */ }
}
