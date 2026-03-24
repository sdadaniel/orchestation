import { NextResponse } from "next/server";
import os from "os";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

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

  const total = totalUser + totalSys + totalIdle;
  return {
    user: +((totalUser / total) * 100).toFixed(2),
    system: +((totalSys / total) * 100).toFixed(2),
    idle: +((totalIdle / total) * 100).toFixed(2),
  };
}

function getProcessCount(): number {
  try {
    const result = execSync("ps -A | wc -l", { encoding: "utf-8", timeout: 3000 });
    return Math.max(0, parseInt(result.trim(), 10) - 1); // subtract header
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
    timestamp: Date.now(),
  });
}
