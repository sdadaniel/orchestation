"use client";

import { useState, useEffect, useCallback } from "react";
import { Moon, Play, Square, Clock, DollarSign, FileText, Loader2, CheckCircle2, XCircle, History, Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type NightWorkerStatus = "idle" | "running" | "completed" | "stopped" | "failed";

const TASK_TYPES = [
  { id: "typecheck", label: "TypeScript 타입 오류 수정", icon: "🔧" },
  { id: "lint", label: "ESLint / 린트 정리", icon: "🧹" },
  { id: "unused", label: "미사용 코드/import 제거", icon: "🗑️" },
  { id: "docs", label: "코드 분석 문서 작성", icon: "📝" },
  { id: "test", label: "테스트 커버리지 보강", icon: "🧪" },
  { id: "review", label: "코드 품질 검토 보고서", icon: "🔍" },
] as const;

export default function NightWorkerPage() {
  const [instructions, setInstructions] = useState("");
  const [untilTime, setUntilTime] = useState("07:00");
  const [budget, setBudget] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [maxTasks, setMaxTasks] = useState("10");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(["typecheck", "lint", "review"]));
  const [status, setStatus] = useState<NightWorkerStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [tasksCreated, setTasksCreated] = useState(0);
  const [totalCost, setTotalCost] = useState("0");
  const [activeTab, setActiveTab] = useState<"config" | "logs">("config");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/night-worker");
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
      setLogs(data.logs || []);
      setTasksCreated(data.tasksCreated ?? 0);
      setTotalCost(data.totalCost ?? "0");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const toggleType = (id: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStart = async () => {
    if (!instructions.trim() && selectedTypes.size === 0) {
      alert("지시 내용을 입력하거나 태스크 유형을 선택해주세요.");
      return;
    }
    try {
      const res = await fetch("/api/night-worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          until: untilTime,
          budget: unlimited ? undefined : parseFloat(budget),
          maxTasks: parseInt(maxTasks, 10),
          types: [...selectedTypes].join(","),
          instructions: instructions.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "시작 실패");
        return;
      }
      setStatus("running");
      setActiveTab("logs");
    } catch {
      alert("시작 요청 실패");
    }
  };

  const handleStop = async () => {
    try {
      await fetch("/api/night-worker", { method: "DELETE" });
      setStatus("stopped");
    } catch { /* ignore */ }
  };

  const isRunning = status === "running";

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Moon className="h-5 w-5 text-yellow-400" />
          <h1 className="text-lg font-semibold">Night Worker</h1>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              Running — {tasksCreated}개 생성 / ${totalCost}
            </span>
          )}
          {status === "completed" && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
              <CheckCircle2 className="h-3 w-3" />
              완료 — {tasksCreated}개 생성 / ${totalCost}
            </span>
          )}
          {status === "stopped" && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              <Square className="h-3 w-3" />
              중지됨
            </span>
          )}
        </div>
        <div>
          {!isRunning ? (
            <button
              type="button"
              onClick={handleStart}
              className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-md bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/25 transition-colors font-semibold"
            >
              <Play className="h-3.5 w-3.5" />
              시작
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-md bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors font-semibold"
            >
              <Square className="h-3.5 w-3.5" />
              중지
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        코드를 스캔하여 이슈를 찾고 태스크를 자동 생성합니다. 실행은 orchestrate.sh가 처리합니다. 브랜치: <code className="text-yellow-400">nm/</code>
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          { key: "config" as const, label: "설정" },
          { key: "logs" as const, label: "로그", count: logs.length },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.key ? "border-yellow-400 text-yellow-400" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-[9px] px-1 rounded bg-muted text-muted-foreground">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Config Tab */}
      {activeTab === "config" && (
        <div className="space-y-5">
          {/* Task Types */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              <Zap className="h-3 w-3 inline mr-1" />
              태스크 유형
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TASK_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleType(t.id)}
                  disabled={isRunning}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-colors",
                    selectedTypes.has(t.id)
                      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                      : "border-border bg-muted/20 text-muted-foreground hover:border-border/80",
                    isRunning && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              <FileText className="h-3 w-3 inline mr-1" />
              추가 지시 (선택)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={"추가 지시가 있으면 작성하세요...\n예: src/frontend 폴더만 점검해줘"}
              rows={3}
              disabled={isRunning}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/40 resize-y disabled:opacity-50"
            />
          </div>

          {/* Settings Row */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                <Clock className="h-3 w-3 inline mr-1" />
                종료 시간
              </label>
              <input
                type="time"
                value={untilTime}
                onChange={(e) => setUntilTime(e.target.value)}
                disabled={isRunning}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                <DollarSign className="h-3 w-3 inline mr-1" />
                예산 한도
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => { setBudget(e.target.value); if (e.target.value) setUnlimited(false); }}
                  placeholder="5.00"
                  step="0.5"
                  min="0"
                  disabled={isRunning || unlimited}
                  className={cn(
                    "flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors disabled:opacity-50",
                    unlimited && "opacity-30",
                  )}
                />
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={unlimited}
                    onChange={(e) => { setUnlimited(e.target.checked); if (e.target.checked) setBudget(""); }}
                    disabled={isRunning}
                    className="rounded"
                  />
                  무제한
                </label>
              </div>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                최대 태스크 수
              </label>
              <input
                type="number"
                value={maxTasks}
                onChange={(e) => setMaxTasks(e.target.value)}
                min="1"
                max="50"
                disabled={isRunning}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
            <div className="text-xs text-yellow-400 font-medium mb-1">실행 요약</div>
            <ul className="text-[11px] text-muted-foreground space-y-0.5">
              <li>종료: {untilTime} / 예산: {unlimited ? "무제한" : `$${budget || "0"}`} / 최대 {maxTasks}개 태스크</li>
              <li>유형: {selectedTypes.size === 0 ? "없음" : [...selectedTypes].map((id) => TASK_TYPES.find((t) => t.id === id)?.label).join(", ")}</li>
              {instructions.trim() && <li>추가 지시: {instructions.slice(0, 80)}{instructions.length > 80 ? "..." : ""}</li>}
              <li>브랜치 접두사: <code className="text-yellow-400">nm/</code></li>
            </ul>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        logs.length > 0 ? (
          <div className="rounded-lg border border-border bg-[#0d1117] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161b22] border-b border-border">
              {isRunning && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                </span>
              )}
              <span className="text-[11px] text-zinc-400 font-mono">NIGHT WORKER</span>
              <span className="text-[10px] text-zinc-600 ml-auto font-mono">{logs.length} lines</span>
            </div>
            <div className="overflow-y-auto max-h-[400px] p-0 font-mono text-[11px] leading-[1.7]">
              {[...logs].reverse().map((line, i) => (
                <div key={i} className="px-3 py-0.5 hover:bg-white/[0.03] text-zinc-400">
                  <span className="text-zinc-600 select-none mr-3 inline-block w-5 text-right">{logs.length - i}</span>
                  {line}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Moon className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">아직 로그가 없습니다. Night Worker를 시작하세요.</p>
          </div>
        )
      )}
    </div>
  );
}
