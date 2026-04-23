"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Play, Square, Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors/error-utils";
import { useOrchestrationStore } from "@/store/orchestrationStore";

type OrchestrateWsReq = {
  type: "req";
  id: string;
  method: "orchestrate.run" | "orchestrate.stop";
};

type OrchestrateWsRes = {
  type: "res";
  id: string;
  ok: boolean;
  error?: string;
  status?: string;
};

export default function AutoImproveControl({
  runningTaskCount = 0,
}: {
  runningTaskCount?: number;
} = {}) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, (res: OrchestrateWsRes) => void>>(new Map());

  // Orchestration 상태를 store에서 직접 구독 (별도 polling 제거)
  const orchestrationStatus = useOrchestrationStore((s) => s.data.status);
  const exitCode = useOrchestrationStore((s) => s.data.exitCode);

  // isStarting 해제: running으로 바뀔 때만 해제
  const prevStatusRef = useRef(orchestrationStatus);
  useEffect(() => {
    if (
      isStarting &&
      prevStatusRef.current !== "running" &&
      orchestrationStatus === "running"
    ) {
      setIsStarting(false);
    }
    prevStatusRef.current = orchestrationStatus;
  }, [isStarting, orchestrationStatus]);

  // isStarting 타임아웃: 15초 안에 running 안 되면 자동 해제
  useEffect(() => {
    if (!isStarting) return;
    const timer = setTimeout(() => setIsStarting(false), 15000);
    return () => clearTimeout(timer);
  }, [isStarting]);

  // isStopping 해제: orchestration이 실제로 멈추면 stopping 상태 해제
  useEffect(() => {
    if (isStopping && orchestrationStatus !== "running") {
      setIsStopping(false);
    }
  }, [isStopping, orchestrationStatus]);

  const status = isStarting
    ? "starting"
    : isStopping
      ? "stopping"
      : orchestrationStatus;

  // failed 상태일 때 에러 메시지 표시 (Stop에 의한 종료(130)는 제외)
  const showError =
    orchestrationStatus === "failed" &&
    exitCode != null &&
    exitCode !== 130 &&
    !isStopping;

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${proto}://${window.location.host}/ws/orchestrate`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(String(e.data ?? "")) as OrchestrateWsRes;
          if (data?.type !== "res" || typeof data.id !== "string") return;
          const resolve = pendingRef.current.get(data.id);
          if (!resolve) return;
          pendingRef.current.delete(data.id);
          resolve(data);
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        // best-effort reconnect (doesn't block UI; actions will error if used while down)
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 800);
        }
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const sendWs = async (
    method: OrchestrateWsReq["method"],
  ): Promise<OrchestrateWsRes> => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now());

    const req: OrchestrateWsReq = { type: "req", id, method };
    const p = new Promise<OrchestrateWsRes>((resolve, reject) => {
      pendingRef.current.set(id, resolve);
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id);
          reject(new Error("Request timed out"));
        }
      }, 8000);
    });

    ws.send(JSON.stringify(req));
    return await p;
  };

  const handleRun = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const res = await sendWs("orchestrate.run");
      if (!res.ok) {
        setError(res.error || "Failed to start");
        setIsStarting(false);
      }
      // store의 polling이 running 감지하면 isStarting 자동 해제
    } catch (err) {
      setError(getErrorMessage(err, "Network error"));
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    setError(null);
    setIsStopping(true);
    try {
      const res = await sendWs("orchestrate.stop");
      if (!res.ok) {
        setError(res.error || "Failed to stop");
        setIsStopping(false);
      }
      // store의 polling이 실제 종료 감지하면 상태가 idle로 전환됨
    } catch (err) {
      setError(getErrorMessage(err, "Network error"));
      setIsStopping(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {status === "starting" ? (
        <span className="filter-pill flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Starting...
        </span>
      ) : status === "stopping" ? (
        <span className="filter-pill flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Stopping...
        </span>
      ) : status === "running" ? (
        <>
          <div className="running-indicator">
            <span className="running-indicator-spinner" />
            <span className="running-indicator-text">
              Running
              <span className="running-indicator-dots" />
            </span>
            {runningTaskCount > 0 && (
              <span className="running-indicator-count">
                {runningTaskCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleStop}
            disabled={isStopping}
            className={cn(
              "filter-pill flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300",
              isStopping && "opacity-50 cursor-not-allowed",
            )}
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleRun}
          disabled={isStarting}
          className={cn(
            "filter-pill active flex items-center gap-1.5 text-xs",
            isStarting && "opacity-50 cursor-not-allowed",
          )}
        >
          <Play className="h-3 w-3" />
          Run
        </button>
      )}

      {showError && (
        <span className="text-xs text-red-500">
          실행 실패 (exit code: {exitCode ?? "unknown"})
        </span>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
