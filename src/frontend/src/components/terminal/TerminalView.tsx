"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

export function TerminalView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: "#1a1a2e",
        foreground: "#e0e0e0",
        cursor: "#e0e0e0",
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
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`);

    ws.onopen = () => {
      // Send initial size
      ws.send(
        JSON.stringify({
          type: "resize",
          cols: terminal.cols,
          rows: terminal.rows,
        })
      );
    };

    let dead = false;

    ws.onmessage = (event) => {
      const data = event.data;
      if (typeof data === "string" && data.startsWith("{")) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "error") {
            terminal.write(
              `\r\n\x1b[31m[Terminal Error] ${parsed.message}\x1b[0m\r\n`
            );
            terminal.write(
              "\x1b[90m페이지를 새로고침하여 다시 시도하세요.\x1b[0m\r\n"
            );
            dead = true;
            return;
          }
        } catch {
          // Not JSON, fall through
        }
      }
      terminal.write(data);
    };

    ws.onclose = (event) => {
      if (event.code === 4000) {
        terminal.write("\r\n\x1b[31m[터미널 시작 실패]\x1b[0m\r\n");
        terminal.write(
          "\x1b[90m페이지를 새로고침하여 다시 시도하세요.\x1b[0m\r\n"
        );
      } else {
        terminal.write("\r\n\x1b[90m[연결 종료]\x1b[0m\r\n");
      }
      dead = true;
    };

    terminal.onData((data) => {
      if (!dead && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Resize handling
    terminal.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      ws.close();
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
