import { createServer } from "http";
import fs from "fs";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import os from "os";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  const wss = new WebSocketServer({ server });

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
        ws.send(`[error] Failed to spawn terminal: ${reason}\r\n`);
        ws.close();
      }
      return;
    }

    console.log(`[pty] spawned shell="${shell}" pid=${ptyProcess.pid}`);

    ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`[pty] exited code=${exitCode}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    ws.on("message", (msg: Buffer | string) => {
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
    });

    ws.on("close", () => {
      console.log(`[pty] client disconnected, killing pid=${ptyProcess.pid}`);
      ptyProcess.kill();
    });

    ws.on("error", (err: Error) => {
      console.error(`[ws] error: ${err.message}`);
      ptyProcess.kill();
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
