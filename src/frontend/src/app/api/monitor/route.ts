import { NextResponse } from "next/server";
import os from "os";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

// 이전 CPU 시간을 저장하여 델타 계산
let prevTimes: { user: number; sys: number; idle: number } | null = null;

export interface ClaudeProcess {
  pid: number;
  cpu: number;
  mem: number;
  memMB: number;
  command: string;
  label: string; // 터미널 식별 라벨
}

function getClaudeProcesses(): ClaudeProcess[] {
  try {
    // claude CLI 프로세스만 필터 (Desktop app 제외)
    const result = execSync(
      `ps aux | grep -E '[c]laude' | grep -v 'Claude.app' | grep -v grep`,
      { encoding: "utf-8", timeout: 3000 }
    );
    const totalMem = os.totalmem();
    const lines = result.trim().split("\n").filter(Boolean);
    let terminalIdx = 0;

    return lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[1], 10);
        const cpu = parseFloat(parts[2]) || 0;
        const mem = parseFloat(parts[3]) || 0;
        const command = parts.slice(10).join(" ");
        const memMB = +((mem / 100) * totalMem / 1024 / 1024).toFixed(1);

        return { pid, cpu, mem, memMB, command, label: "" };
      })
      .filter((p) => p.mem > 0.05) // 의미있는 프로세스만
      .sort((a, b) => b.mem - a.mem)
      .map((p) => {
        terminalIdx++;
        return { ...p, label: `Terminal ${terminalIdx} (PID ${p.pid})` };
      });
  } catch {
    return [];
  }
}

function getCpuUsage() {
  const cpus = os.cpus();
  let totalUser = 0;
  let totalSys = 0;
  let totalIdle = 0;

  for (const cpu of cpus) {
    totalUser += cpu.times.user + cpu.times.nice;
    totalSys += cpu.times.sys + cpu.times.irq;
    totalIdle += cpu.times.idle;
  }

  if (!prevTimes) {
    // 첫 호출: 저장만 하고 누적 비율 반환
    prevTimes = { user: totalUser, sys: totalSys, idle: totalIdle };
    const total = totalUser + totalSys + totalIdle;
    return {
      user: +((totalUser / total) * 100).toFixed(2),
      system: +((totalSys / total) * 100).toFixed(2),
      idle: +((totalIdle / total) * 100).toFixed(2),
    };
  }

  // 델타 계산 (이전 측정 이후 변화량)
  const dUser = totalUser - prevTimes.user;
  const dSys = totalSys - prevTimes.sys;
  const dIdle = totalIdle - prevTimes.idle;
  const dTotal = dUser + dSys + dIdle;

  prevTimes = { user: totalUser, sys: totalSys, idle: totalIdle };

  if (dTotal === 0) {
    return { user: 0, system: 0, idle: 100 };
  }

  return {
    user: +((dUser / dTotal) * 100).toFixed(2),
    system: +((dSys / dTotal) * 100).toFixed(2),
    idle: +((dIdle / dTotal) * 100).toFixed(2),
  };
}

function getProcessCount(): number {
  try {
    const result = execSync("ps -A | wc -l", { encoding: "utf-8", timeout: 3000 });
    return Math.max(0, parseInt(result.trim(), 10) - 1);
  } catch {
    return 0;
  }
}

function getThreadCount(): number {
  try {
    const result = execSync("ps -M -A | wc -l", { encoding: "utf-8", timeout: 3000 });
    return Math.max(0, parseInt(result.trim(), 10) - 1);
  } catch {
    return 0;
  }
}

export async function GET() {
  const cpu = getCpuUsage();
  const loadAvg = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const processCount = getProcessCount();
  const threadCount = getThreadCount();

  const claudeProcesses = getClaudeProcesses();

  return NextResponse.json({
    cpu,
    loadAvg: {
      "1m": +loadAvg[0].toFixed(2),
      "5m": +loadAvg[1].toFixed(2),
      "15m": +loadAvg[2].toFixed(2),
    },
    memory: {
      total: totalMem,
      free: freeMem,
      used: totalMem - freeMem,
      usedPercent: +(((totalMem - freeMem) / totalMem) * 100).toFixed(2),
    },
    processCount,
    threadCount,
    cpuCores: os.cpus().length,
    claudeProcesses,
    timestamp: Date.now(),
  });
}
