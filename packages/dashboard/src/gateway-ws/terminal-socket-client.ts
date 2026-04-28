"use client";

export interface TerminalSocketClientOpts {
  url: string;
  onOpen?: () => void;
  onData?: (data: string) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: () => void;
}

export interface TerminalSocketClient {
  close(): void;
  readyState(): number;
  send(data: string): void;
  sendJson(payload: unknown): void;
}

export function createTerminalSocketClient(
  opts: TerminalSocketClientOpts,
): TerminalSocketClient {
  const ws = new WebSocket(opts.url);

  ws.onopen = () => {
    opts.onOpen?.();
  };

  ws.onmessage = (event) => {
    opts.onData?.(String(event.data ?? ""));
  };

  ws.onclose = (event) => {
    opts.onClose?.(event);
  };

  ws.onerror = () => {
    opts.onError?.();
  };

  return {
    close() {
      ws.close();
    },
    readyState() {
      return ws.readyState;
    },
    send(data: string) {
      ws.send(data);
    },
    sendJson(payload: unknown) {
      ws.send(JSON.stringify(payload));
    },
  };
}
