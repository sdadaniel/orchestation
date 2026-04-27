"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { createTerminalSocketClient } from "@/gateway-ws/terminal-socket-client";

export function TerminalView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily:
        "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: "#0a0a0a",
        foreground: "#e4e4e7",
        cursor: "#60a5fa",
        selectionBackground: "#27272a",
      },
    });
    terminalRef.current = terminal;

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(container);
    fitAddon.fit();

    // WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = createTerminalSocketClient({
      url: `${protocol}//${window.location.host}/ws/terminal`,
      onOpen: () => {
      // Send initial size
        socket.sendJson({
          type: "resize",
          cols: terminal.cols,
          rows: terminal.rows,
        });
      },
      onData: (data) => {
        if (data.startsWith("{")) {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "error") {
              terminal.write(
                `\r\n\x1b[31m[Terminal Error] ${parsed.message}\x1b[0m\r\n`,
              );
              terminal.write(
                "\x1b[90m페이지를 새로고침하여 다시 시도하세요.\x1b[0m\r\n",
              );
              dead = true;
              return;
            }
          } catch {
            // Not JSON, fall through
          }
        }
        terminal.write(data);
      },
      onClose: (event) => {
        if (event.code === 4000) {
          terminal.write("\r\n\x1b[31m[터미널 시작 실패]\x1b[0m\r\n");
          terminal.write(
            "\x1b[90m페이지를 새로고침하여 다시 시도하세요.\x1b[0m\r\n",
          );
        } else {
          terminal.write("\r\n\x1b[90m[연결 종료]\x1b[0m\r\n");
        }
        dead = true;
      },
    });

    let dead = false;

    terminal.onData((data) => {
      if (!dead && socket.readyState() === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    // Resize handling
    terminal.onResize(({ cols, rows }) => {
      if (socket.readyState() === WebSocket.OPEN) {
        socket.sendJson({ type: "resize", cols, rows });
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      socket.close();
      terminal.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ minHeight: 0 }}
    />
  );
}
