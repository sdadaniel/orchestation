import type { z } from "zod";

export interface RpcRequest {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

export interface RpcResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

export interface RpcMethodDef<P = unknown, R = unknown> {
  name: string;
  idempotent: boolean;
  paramsSchema: z.ZodType<P>;
  handler: (params: P) => Promise<R> | R;
}
