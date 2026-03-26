import { createServer } from "http";
import fs, { appendFileSync } from "fs";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import os from "os";

import { resolve } from "path";

const CRASH_LOG = resolve(process.cwd(), "../..", ".orchestration/output/crash.log");

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

  // Only upgrade /ws/terminal — let Next.js HMR handle its own WebSockets
  server.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws/terminal") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
    // Other upgrade requests (e.g. /_next/webpack-hmr) pass through to Next.js
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
      const reason = err instanceof Error ? err.message : String(err);
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
