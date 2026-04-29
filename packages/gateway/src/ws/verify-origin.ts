import type { IncomingMessage } from "http";

function allowedOrigins(port: number): Set<string> {
  return new Set([
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ]);
}

export function verifyOrigin(req: IncomingMessage, port: number): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    // Browsers always send origin on WS requests. No origin = non-browser client.
    // Allow in dev, block in prod.
    return process.env.NODE_ENV !== "production";
  }
  return allowedOrigins(port).has(origin);
}
