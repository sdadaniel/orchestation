import { createServer } from "http";
import fs, { appendFileSync, watchFile, unwatchFile } from "fs";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import os from "os";
import { resolve } from "path";
import taskRunnerManager from "./src/lib/task-runner-manager";
import { getErrorMessage } from "./src/lib/error-utils";

const _PROJECT_ROOT = process.env.PROJECT_ROOT || resolve(process.cwd(), "../..");
const CRASH_LOG = resolve(_PROJECT_ROOT, ".orchestration/output/crash.log");

function logCrash(type: string, err: Error | unknown) {
  const ts = new Date().toISOString();
  const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  const line = `[${ts}] ${type}: ${msg}\n`;
  try { appendFileSync(CRASH_LOG, line); } catch { /* ignore */ }
  console.error(`[${type}]`, err);
}

// Suppress benign WebSocket frame errors from race conditions
process.on("uncaughtException", (err) => {
  if (err.message?.includes("Invalid WebSocket frame")) {
    console.warn(`[ws] suppressed frame error: ${err.message}`);
    return;
  }
  logCrash("uncaughtException", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logCrash("unhandledRejection", reason);
});

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true });
  const wssTaskLogs = new WebSocketServer({ noServer: true });
  const wssTaskTerminal = new WebSocketServer({ noServer: true });

  // Upgrade handler: route to correct WebSocket server
  server.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws/terminal") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else if (req.url?.startsWith("/ws/task-terminal/")) {
      wssTaskTerminal.handleUpgrade(req, socket, head, (ws) => {
        wssTaskTerminal.emit("connection", ws, req);
      });
    } else if (req.url?.startsWith("/ws/task-logs/")) {
      wssTaskLogs.handleUpgrade(req, socket, head, (ws) => {
        wssTaskLogs.emit("connection", ws, req);
      });
    }
    // Other upgrade requests (e.g. /_next/webpack-hmr) pass through to Next.js
  });

  const PROJECT_ROOT = _PROJECT_ROOT;
  const OUTPUT_DIR = resolve(PROJECT_ROOT, "output");

  // ── Task Terminal WebSocket (JSONL conversation stream) ──────
  wssTaskTerminal.on("connection", (ws: WebSocket, req) => {
    const taskId = req.url?.replace("/ws/task-terminal/", "") ?? "";
    if (!/^TASK-\d+$/.test(taskId)) {
      ws.close(4001, "invalid-task-id");
      return;
    }

    console.log(`[ws:task-terminal] connected for ${taskId}`);

    const ORCH_OUTPUT_DIR = resolve(PROJECT_ROOT, ".orchestration", "output");
    const jsonlFiles = [
      resolve(OUTPUT_DIR, `${taskId}-task-conversation.jsonl`),
      resolve(ORCH_OUTPUT_DIR, `${taskId}-task-conversation.jsonl`),
    ];
    const fileOffsets = new Map<string, number>();

    const sendJsonlUpdates = (filePath: string) => {
      try {
        if (!fs.existsSync(filePath)) return;
        const stat = fs.statSync(filePath);
        const offset = fileOffsets.get(filePath) ?? 0;
        if (stat.size <= offset) return;

        const fd = fs.openSync(filePath, "r");
        const buf = Buffer.alloc(stat.size - offset);
        fs.readSync(fd, buf, 0, buf.length, offset);
        fs.closeSync(fd);
        fileOffsets.set(filePath, stat.size);

        const rawLines = buf.toString("utf-8").split("\n");
        const validLines = rawLines.map((l) => l.trim()).filter((l) => l);
        if (validLines.length > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "batch", lines: validLines }));
        }
      } catch {
        // file may not exist yet
      }
    };

    // Send existing content
    for (const f of jsonlFiles) sendJsonlUpdates(f);

    // Watch for new content
    const watchOpts = { interval: 500 };
    for (const f of jsonlFiles) {
      watchFile(f, watchOpts, () => sendJsonlUpdates(f));
    }

    const cleanup = () => {
      for (const f of jsonlFiles) unwatchFile(f);
    };

    ws.on("close", () => {
      console.log(`[ws:task-terminal] disconnected for ${taskId}`);
      cleanup();
    });
    ws.on("error", (err: Error) => {
      console.error(`[ws:task-terminal] error for ${taskId}: ${err.message}`);
      cleanup();
    });
  });

  // ── Task Logs WebSocket ───────────────────────────────────────
  wssTaskLogs.on("connection", (ws: WebSocket, req) => {
    const taskId = req.url?.replace("/ws/task-logs/", "") ?? "";
    if (!/^TASK-\d+$/.test(taskId)) {
      ws.close(4001, "invalid-task-id");
      return;
    }

    console.log(`[ws:task-logs] connected for ${taskId}`);

    // ── Source 1: TaskRunnerManager (UI-triggered runs) ──
    const runState = taskRunnerManager.getState(taskId);
    if (runState) {
      // Send existing logs
      for (const line of runState.logs) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "log", line }));
        }
      }
      // If already done, send status and close
      if (runState.status !== "running") {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "status", status: runState.status }));
        }
      }
    }

    // Subscribe to new log lines
    const onLog = (line: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "log", line }));
      }
    };
    const onDone = (status: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "status", status }));
      }
    };

    taskRunnerManager.events.on(`log:${taskId}`, onLog);
    taskRunnerManager.events.on(`done:${taskId}`, onDone);

    // ── Source 2: File-based logs (orchestrate.sh pipeline runs) ──
    // Watch multiple log sources across both output directories
    const ORCH_OUTPUT_DIR = resolve(PROJECT_ROOT, ".orchestration", "output");
    const watchedFiles: string[] = [
      resolve(OUTPUT_DIR, "logs", `${taskId}.log`),
      resolve(ORCH_OUTPUT_DIR, "logs", `${taskId}.log`),
    ];
    const fileOffsets = new Map<string, number>();

    const sendFileUpdates = (filePath: string) => {
      try {
        if (!fs.existsSync(filePath)) return;
        const stat = fs.statSync(filePath);
        const offset = fileOffsets.get(filePath) ?? 0;
        if (stat.size <= offset) return;

        const fd = fs.openSync(filePath, "r");
        const buf = Buffer.alloc(stat.size - offset);
        fs.readSync(fd, buf, 0, buf.length, offset);
        fs.closeSync(fd);
        fileOffsets.set(filePath, stat.size);

        const rawLines = buf.toString("utf-8").split("\n");
        for (const raw of rawLines) {
          const trimmed = raw.trim();
          if (!trimmed) continue;
          if (ws.readyState !== WebSocket.OPEN) return;

          ws.send(JSON.stringify({ type: "log", line: trimmed }));
        }
      } catch {
        // file may not exist yet
      }
    };

    // Send existing content and start watching
    // If task is managed by TaskRunnerManager, skip .log files (already streamed via events)
    const isManaged = !!taskRunnerManager.getState(taskId);
    const watchOpts = { interval: 500 };
    for (const f of watchedFiles) {
      if (isManaged && f.endsWith(".log")) continue; // avoid duplicate
      sendFileUpdates(f);
      watchFile(f, watchOpts, () => sendFileUpdates(f));
    }

    // ── Cleanup ──
    const cleanup = () => {
      taskRunnerManager.events.off(`log:${taskId}`, onLog);
      taskRunnerManager.events.off(`done:${taskId}`, onDone);
      for (const f of watchedFiles) unwatchFile(f);
    };

    ws.on("close", () => {
      console.log(`[ws:task-logs] disconnected for ${taskId}`);
      cleanup();
    });

    ws.on("error", (err: Error) => {
      console.error(`[ws:task-logs] error for ${taskId}: ${err.message}`);
      cleanup();
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    // Resolve shell path with fallback chain
    const resolveShell = (): string => {
      if (os.platform() === "win32") return "powershell.exe";
      const candidates = [
        process.env.SHELL,
        "/bin/zsh",
        "/bin/bash",
        "/bin/sh",
      ];
      for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) return candidate;
      }
      return "/bin/sh";
    };

    const shell = resolveShell();

    // Filter out undefined values from process.env
    const cleanEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        cleanEnv[key] = value;
      }
    }

    let ptyProcess: pty.IPty;
    try {
      ptyProcess = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: cleanEnv,
      });
    } catch (err) {
      const reason = getErrorMessage(err, String(err));
      console.error(`[pty] failed to spawn shell="${shell}": ${reason}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: reason }));
        ws.close(4000, "pty-spawn-failed");
      }
      return;
    }

    console.log(`[pty] spawned shell="${shell}" pid=${ptyProcess.pid}`);

    // idle timeout: 5분간 데이터 없으면 자동 종료
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
    let idleTimer = setTimeout(() => {
      console.log(`[pty] idle timeout, killing pid=${ptyProcess.pid}`);
      ptyProcess.kill();
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }, IDLE_TIMEOUT_MS);

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        console.log(`[pty] idle timeout, killing pid=${ptyProcess.pid}`);
        ptyProcess.kill();
        if (ws.readyState === WebSocket.OPEN) ws.close();
      }, IDLE_TIMEOUT_MS);
    };

    ptyProcess.onData((data: string) => {
      resetIdleTimer();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`[pty] exited code=${exitCode}`);
      clearTimeout(idleTimer);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    ws.on("message", (msg: Buffer | string) => {
      try {
        const input = typeof msg === "string" ? msg : msg.toString("utf-8");

        // Handle resize messages (JSON format: {"type":"resize","cols":N,"rows":N})
        if (typeof input === "string" && input.startsWith("{")) {
          try {
            const parsed = JSON.parse(input);
            if (parsed.type === "resize" && parsed.cols && parsed.rows) {
              ptyProcess.resize(parsed.cols, parsed.rows);
              return;
            }
          } catch {
            // Not JSON, treat as regular input
          }
        }

        ptyProcess.write(input);
      } catch (err) {
        console.warn(`[ws] message handling error: ${err}`);
      }
    });

    ws.on("close", () => {
      console.log(`[pty] client disconnected, killing pid=${ptyProcess.pid}`);
      clearTimeout(idleTimer);
      ptyProcess.kill();
    });

    ws.on("error", (err: Error) => {
      console.error(`[ws] error: ${err.message}`);
      clearTimeout(idleTimer);
      ptyProcess.kill();
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
