"use client";

import { useState, useEffect, useCallback } from "react";
import { Moon, Play, Square, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";

type NightWorkerStatus = "idle" | "running" | "completed" | "stopped" | "failed";

const TASK_TYPES = [
  { id: "typecheck", label: "TypeScript 타입 오류 수정" },
  { id: "lint", label: "ESLint / 린트 정리" },
  { id: "unused", label: "미사용 코드/import 제거" },
  { id: "docs", label: "코드 분석 문서 작성" },
  { id: "test", label: "테스트 커버리지 보강" },
  { id: "review", label: "코드 품질 검토 보고서" },
] as const;

export default function NightWorkerPage() {
  const [instructions, setInstructions] = useState("");
  const [untilTime, setUntilTime] = useState("07:00");
  const [budget, setBudget] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [maxTasks, setMaxTasks] = useState(10);
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
          maxTasks,
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
    <PageLayout className="max-w-2xl mx-auto">
      <PageHeader title="Night Worker">
        {!isRunning ? (
          <button
            type="button"
            onClick={handleStart}
            className="filter-pill active flex items-center gap-1 bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/25"
          >
            <Play className="h-3.5 w-3.5" />
            Start
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            className="filter-pill active flex items-center gap-1 bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </button>
        )}
      </PageHeader>

      <div className="space-y-4">

        {/* Card 1: Name + Instructions + Until */}
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value="Night Worker"
              readOnly
              className="cursor-default"
            />
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground/60 font-mono">
                {isRunning ? `${tasksCreated} tasks created / $${totalCost}` : "코드 스캔 후 이슈 태스크 자동 생성 · branch: nm/"}
              </p>
              {isRunning && (
                <span className="flex items-center gap-1.5 text-[11px] text-yellow-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Running
                </span>
              )}
              {status === "completed" && (
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Completed
                </span>
              )}
              {status === "stopped" && (
                <span className="text-[11px] text-muted-foreground">Stopped</span>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <Label>System instructions</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={"추가 지시가 있으면 작성하세요...\n예: src/frontend 폴더만 점검해줘"}
              rows={4}
              disabled={isRunning}
              className="min-h-[100px]"
            />
          </div>

          {/* Until Time */}
          <div className="space-y-1.5">
            <Label>Until</Label>
            <Input
              type="time"
              value={untilTime}
              onChange={(e) => setUntilTime(e.target.value)}
              disabled={isRunning}
            />
          </div>
        </div>

        {/* Card 2: Task Types */}
        <div className="space-y-4">
          <Label size="section">Task Types</Label>

          {TASK_TYPES.map((t) => (
            <div key={t.id} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{t.label}</span>
              <Toggle
                checked={selectedTypes.has(t.id)}
                onChange={() => toggleType(t.id)}
                disabled={isRunning}
              />
            </div>
          ))}
        </div>

        {/* Card 3: Configuration (Budget + Max Tasks) */}
        <div className="space-y-4">
          <Label size="section">Configuration</Label>

          {/* Budget */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Budget limit</Label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={unlimited}
                  onChange={(e) => { setUnlimited(e.target.checked); if (e.target.checked) setBudget(""); }}
                  disabled={isRunning}
                />
                Unlimited
              </label>
            </div>
            <Input
              type="number"
              value={budget}
              onChange={(e) => { setBudget(e.target.value); if (e.target.value) setUnlimited(false); }}
              placeholder="5.00"
              step="0.5"
              min="0"
              disabled={isRunning || unlimited}
              className={cn(unlimited && "opacity-30")}
            />
          </div>

          {/* Max Tasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Max tasks</Label>
              <span className="text-sm text-foreground tabular-nums">{maxTasks}</span>
            </div>
            <Slider
              min={1}
              max={50}
              value={maxTasks}
              onChange={setMaxTasks}
              disabled={isRunning}
            />
          </div>
        </div>

        {/* Summary / Logs Tabs */}
        <div className="space-y-4">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("config")}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md transition-colors",
                activeTab === "config"
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("logs")}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md transition-colors",
                activeTab === "logs"
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Logs {logs.length > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({logs.length})</span>}
            </button>
          </div>

          {activeTab === "config" && (
            <div className="bg-muted border border-border rounded-md p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Until</span>
                <span>{untilTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Budget</span>
                <span>{unlimited ? "Unlimited" : `$${budget || "0"}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max tasks</span>
                <span>{maxTasks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Types</span>
                <span className="text-right max-w-[300px]">
                  {selectedTypes.size === 0 ? "None" : [...selectedTypes].map((id) => TASK_TYPES.find((t) => t.id === id)?.label).join(", ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Branch prefix</span>
                <span className="font-mono text-yellow-400">nm/</span>
              </div>
            </div>
          )}

          {activeTab === "logs" && (
            logs.length > 0 ? (
              <div className="rounded-md border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
                  {isRunning && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground font-mono">NIGHT WORKER</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto font-mono">{logs.length} lines</span>
                </div>
                <div className="overflow-y-auto max-h-[320px] font-mono text-[11px] leading-[1.7] bg-muted/20">
                  {[...logs].reverse().map((line, i) => (
                    <div key={i} className="px-3 py-0.5 hover:bg-muted/40 text-muted-foreground">
                      <span className="text-muted-foreground/30 select-none mr-3 inline-block w-5 text-right">{logs.length - i}</span>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-muted border border-border rounded-md text-center py-8">
                <Moon className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No logs yet</p>
              </div>
            )
          )}
        </div>

      </div>
    </PageLayout>
  );
}
