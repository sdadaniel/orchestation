import { NextResponse } from "next/server";
import os from "os";
import fs from "fs";
import { execSync } from "child_process";
import type { ClaudeProcess } from "@/lib/monitor-types";

export const dynamic = "force-dynamic";

// 이전 CPU 시간을 저장하여 델타 계산
let prevTimes: { user: number; sys: number; idle: number } | null = null;

// /tmp/worker-TASK-XXX.pid 파일들을 읽어 pid→taskId 매핑 반환
function getWorkerPidMap(): Map<number, string> {
  const map = new Map<number, string>();
  try {
    const pidFiles = fs
      .readdirSync("/tmp")
      .filter((f) => /^worker-TASK-\w+\.pid$/.test(f));
    for (const file of pidFiles) {
      const taskId = file.replace(/^worker-/, "").replace(/\.pid$/, "");
      const raw = fs.readFileSync(`/tmp/${file}`, "utf-8").trim();
      const pid = parseInt(raw, 10);
      if (!isNaN(pid) && pid > 0) {
        map.set(pid, taskId);
      }
    }
  } catch {
    // /tmp 읽기 실패 시 빈 맵
  }
  return map;
}

// 프로세스 트리를 1회만 조회하여 parentOf 맵 반환
function getProcessTree(): Map<number, number> {
  const parentOf = new Map<number, number>();
  try {
    const result = execSync("ps axo pid=,ppid=", {
      encoding: "utf-8",
      timeout: 3000,
    });
    for (const line of result.trim().split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const pid = parseInt(parts[0] ?? "", 10);
      const ppid = parseInt(parts[1] ?? "", 10);
      if (!isNaN(pid) && !isNaN(ppid)) {
        parentOf.set(pid, ppid);
      }
    }
  } catch {
    // 실패 시 빈 맵
  }
  return parentOf;
}

// 특정 PID의 모든 자손 PID 목록 (사전 조회된 트리 재사용)
function getDescendantPids(
  rootPid: number,
  parentOf: Map<number, number>,
): Set<number> {
  const descendants = new Set<number>();
  const queue = [rootPid];
  const visited = new Set([rootPid]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [pid, ppid] of parentOf) {
      if (ppid === cur && !visited.has(pid)) {
        visited.add(pid);
        descendants.add(pid);
        queue.push(pid);
      }
    }
  }
  return descendants;
}

function getClaudeProcesses(): ClaudeProcess[] {
  try {
    // claude CLI 프로세스만 필터 (Desktop app 제외)
    const result = execSync(
      `ps aux | grep -E '[c]laude' | grep -v 'Claude.app' | grep -v grep`,
      { encoding: "utf-8", timeout: 3000 },
    );
    const totalMem = os.totalmem();
    const lines = result.trim().split("\n").filter(Boolean);

    // 워커 PID 맵: workerPid → taskId
    const workerPidMap = getWorkerPidMap();

    // 프로세스 트리 1회만 조회 (이전: workerPid마다 ps 실행 → 초당 12회 execSync)
    const processTree = getProcessTree();

    // 워커 PID에서 자손 PID → taskId 역매핑 구축
    const pidToTaskId = new Map<number, string>();
    for (const [workerPid, taskId] of workerPidMap) {
      const descendants = getDescendantPids(workerPid, processTree);
      for (const dpid of descendants) {
        pidToTaskId.set(dpid, taskId);
      }
      // 워커 bash PID 자체도 포함
      pidToTaskId.set(workerPid, taskId);
    }

    let workerIdx = 0;

    const processes = lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) return null;

        const pid = parseInt(parts[1] ?? "", 10);
        if (isNaN(pid)) return null;

        const cpu = parseFloat(parts[2] ?? "NaN");
        const mem = parseFloat(parts[3] ?? "NaN");
        if (isNaN(cpu) || isNaN(mem)) return null;

        const command = parts.slice(10).join(" ");
        const memMB = +(((mem / 100) * totalMem) / 1024 / 1024).toFixed(1);

        // 워커 판별: PID 트리에서 task ID가 매핑된 프로세스만 워커
        const taskIdFromTree = pidToTaskId.get(pid);
        const isWorker = taskIdFromTree !== undefined;
        const taskId = taskIdFromTree;

        return { pid, cpu, mem, memMB, command, label: "", isWorker, taskId };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .filter((p) => p.isWorker && p.mem > 0.05) // 워커만 표시
      .sort((a, b) => b.mem - a.mem)
      .map((p) => {
        workerIdx++;
        const label = p.taskId
          ? `${p.taskId} (PID ${p.pid})`
          : `Worker ${workerIdx} (PID ${p.pid})`;
        return { ...p, label };
      });

    return processes;
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
    const result = execSync("ps -A | wc -l", {
      encoding: "utf-8",
      timeout: 3000,
    });
    return Math.max(0, parseInt(result.trim(), 10) - 1);
  } catch {
    return 0;
  }
}

function getThreadCount(): number {
  try {
    const result = execSync("ps -M -A | wc -l", {
      encoding: "utf-8",
      timeout: 3000,
    });
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
      "1m": +(loadAvg[0] ?? 0).toFixed(2),
      "5m": +(loadAvg[1] ?? 0).toFixed(2),
      "15m": +(loadAvg[2] ?? 0).toFixed(2),
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
