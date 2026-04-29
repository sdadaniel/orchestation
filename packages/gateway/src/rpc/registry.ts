import type { RpcMethodDef } from "./types";

const methods = new Map<string, RpcMethodDef>();

export function registerRpc<P, R>(def: RpcMethodDef<P, R>): void {
  if (methods.has(def.name)) {
    throw new Error(`RPC method already registered: ${def.name}`);
  }
  methods.set(def.name, def as RpcMethodDef);
}

export function getRpc(name: string): RpcMethodDef | undefined {
  return methods.get(name);
}

export function listRpc(): { name: string; idempotent: boolean }[] {
  return Array.from(methods.values()).map((m) => ({
    name: m.name,
    idempotent: m.idempotent,
  }));
}
