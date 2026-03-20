import { createServer } from "http";
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
    const shell =
      os.platform() === "win32"
        ? "powershell.exe"
        : process.env.SHELL || "/bin/bash";

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    });

    console.log(`[pty] spawned pid=${ptyProcess.pid}`);

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
