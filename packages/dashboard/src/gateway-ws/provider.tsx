"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { BusEventType } from "@orchestration/bus-types";
import { createGatewayClient, type GatewayClient } from "./client";
import { createEventHandlers } from "./handlers";

const IDEMPOTENT_METHODS = new Set<string>(["orchestrate.stop"]);

type Listener = (eventType: BusEventType, data: unknown, id: string) => void;
const listeners = new Set<Listener>();

export function subscribeGatewayEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

interface Ctx {
  client: GatewayClient | null;
}

const GatewayCtx = createContext<Ctx>({ client: null });

export function useGatewayClient(): GatewayClient {
  const { client } = useContext(GatewayCtx);
  if (!client) throw new Error("GatewayClient not ready");
  return client;
}

export function useOptionalGatewayClient(): GatewayClient | null {
  const { client } = useContext(GatewayCtx);
  return client;
}

export function GatewayWsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [client, setClient] = useState<GatewayClient | null>(null);

  useEffect(() => {
    const h = createEventHandlers(queryClient);
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws/gateway`;
    const c = createGatewayClient({
      url,
      onEvent: (eventType, data, id) => {
        h.onEvent(eventType, data, id);
        for (const l of listeners) l(eventType, data, id);
      },
      onSnapshot: (snap) => h.onSnapshot(snap),
      isIdempotent: (m) =>
        IDEMPOTENT_METHODS.has(m) || m === "task.conversation.get",
    });
    setClient(c);
    return () => { c.close(); };
  }, [queryClient]);

  return (
    <GatewayCtx.Provider value={{ client }}>
      {children}
    </GatewayCtx.Provider>
  );
}
