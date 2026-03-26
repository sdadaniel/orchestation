import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "@/lib/paths";

export const dynamic = "force-dynamic";

/** Night Worker 상태 인터페이스 */
interface NightWorkerState {
  status: string;
  startedAt: string | null;
  until: string | null;
  budget: string | number | null;
  maxTasks: number;
  tasksCreated: number;
  totalCost: string;
  pid: number | null;
}

const PID_FILE = "/tmp/night-worker.pid";
const STATE_FILE = "/tmp/night-worker.state";
const ORCH_LOG_DIR = path.join(PROJECT_ROOT, ".orchestration", "output", "logs");
const LEGACY_LOG_DIR = path.join(PROJECT_ROOT, "output", "logs");
const LOG_DIR = fs.existsSync(path.join(PROJECT_ROOT, ".orchestration")) ? ORCH_LOG_DIR : LEGACY_LOG_DIR;
const LOG_FILE = path.join(LOG_DIR, "night-worker.log");

/** GET — 상태 + 로그 반환 */
export async function GET() {
  // 상태 파일 읽기
  let state: NightWorkerState = { status: "idle", startedAt: null, until: null, budget: null, maxTasks: 0, tasksCreated: 0, totalCost: "0", pid: null };
  if (fs.existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as NightWorkerState;
    } catch { /* ignore */ }
  }

  // PID 생존 확인
  if (state.pid) {
    try {
      process.kill(state.pid, 0);
    } catch {
      // 프로세스 없음 → idle
      state.status = state.status === "running" ? "completed" : state.status;
      state.pid = null;
    }
  }

  // 로그 읽기 (마지막 200줄)
  let logs: string[] = [];
  if (fs.existsSync(LOG_FILE)) {
    try {
      const content = fs.readFileSync(LOG_FILE, "utf-8");
      logs = content.split("\n").filter(Boolean).slice(-200);
    } catch { /* ignore */ }
  }

  return NextResponse.json({ ...state, logs });
}

/** POST — Night Worker 시작 */
export async function POST(req: NextRequest) {
  // 이미 실행 중인지 확인
  if (fs.existsSync(PID_FILE)) {
    try {
      const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
      process.kill(pid, 0); // 생존 확인
      return NextResponse.json({ error: "Night Worker가 이미 실행 중입니다." }, { status: 409 });
    } catch {
      // PID 파일은 있지만 프로세스 없음 → 정리
      fs.unlinkSync(PID_FILE);
    }
  }

  const body = await req.json();
  const { until = "07:00", budget, maxTasks = 10, types = "typecheck,lint,review", instructions = "" } = body;

  // 로그 파일 초기화
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(LOG_FILE, "", "utf-8");

  // night-worker.sh 실행
  const args = [
    path.join(PROJECT_ROOT, "scripts", "night-worker.sh"),
    "--until", until,
    "--max-tasks", String(maxTasks),
    "--types", types,
  ];
  if (budget) {
    args.push("--budget", String(budget));
  }
  if (instructions) {
    args.push("--instructions", instructions);
  }

  const proc = spawn("bash", args, {
    cwd: PROJECT_ROOT,
    env: { ...process.env },
    stdio: "ignore",
    detached: true,
  });

  proc.unref();

  return NextResponse.json({
    message: "Night Worker 시작됨",
    pid: proc.pid,
    until,
    budget: budget || "unlimited",
    maxTasks,
    types,
  });
}

/** DELETE — Night Worker 중지 */
export async function DELETE() {
  if (!fs.existsSync(PID_FILE)) {
    return NextResponse.json({ error: "실행 중인 Night Worker가 없습니다." }, { status: 409 });
  }

  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
    process.kill(-pid, "SIGTERM"); // 프로세스 그룹 kill
  } catch {
    try {
      const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
      process.kill(pid, "SIGTERM");
    } catch { /* already dead */ }
  }

  // 상태 업데이트
  if (fs.existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as NightWorkerState;
      state.status = "stopped";
      state.pid = null;
      fs.writeFileSync(STATE_FILE, JSON.stringify(state), "utf-8");
    } catch { /* ignore */ }
  }

  try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }

  return NextResponse.json({ message: "Night Worker 중지됨" });
}
