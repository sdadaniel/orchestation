"use client";

import { useState } from "react";
import { Moon, Play, Square, Clock, DollarSign, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type NightWorkerStatus = "idle" | "running" | "completed";

export default function NightWorkerPage() {
  const [instructions, setInstructions] = useState("");
  const [untilTime, setUntilTime] = useState("07:00");
  const [budget, setBudget] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [status, setStatus] = useState<NightWorkerStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);

  const handleStart = async () => {
    if (!instructions.trim()) {
      alert("지시 내용을 입력해주세요.");
      return;
    }
    setStatus("running");
    setLogs(["[Night Worker] 시작 준비 중..."]);
    // TODO: API 연동
  };

  const handleStop = async () => {
    setStatus("idle");
    setLogs((prev) => [...prev, "[Night Worker] 중지됨"]);
    // TODO: API 연동
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Moon className="h-5 w-5 text-yellow-400" />
        <h1 className="text-lg font-semibold">Night Worker</h1>
        {status === "running" && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">Running</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        밤 동안 자동으로 코드를 검토하고 경미한 수정을 수행합니다. 지시 내용을 작성하고 실행하세요.
      </p>

      {/* Instructions */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
          <FileText className="h-3 w-3 inline mr-1" />
          지시 내용
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={"예시:\n- 프론트엔드 TypeScript 타입 오류 점검 및 수정\n- scripts/ 폴더 린트 정리\n- 사용하지 않는 import 제거\n- 코드 품질 분석 보고서 작성 (docs/todo/)"}
          rows={6}
          disabled={status === "running"}
          className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/40 resize-y disabled:opacity-50"
        />
      </div>

      {/* Settings */}
      <div className="flex flex-wrap gap-4">
        {/* Until Time */}
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
            <Clock className="h-3 w-3 inline mr-1" />
            종료 시간
          </label>
          <input
            type="time"
            value={untilTime}
            onChange={(e) => setUntilTime(e.target.value)}
            disabled={status === "running"}
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors disabled:opacity-50"
          />
        </div>

        {/* Budget */}
        <div className="flex-1 min-w-[200px]">
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
              disabled={status === "running" || unlimited}
              className={cn(
                "flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors disabled:opacity-50",
                unlimited && "opacity-30",
              )}
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={unlimited}
                onChange={(e) => { setUnlimited(e.target.checked); if (e.target.checked) setBudget(""); }}
                disabled={status === "running"}
                className="rounded"
              />
              무제한
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {status === "idle" || status === "completed" ? (
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/25 transition-colors font-medium"
          >
            <Play className="h-3.5 w-3.5" />
            Night Worker 시작
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors font-medium"
          >
            <Square className="h-3.5 w-3.5" />
            중지
          </button>
        )}
        {status === "completed" && (
          <span className="text-xs text-emerald-400">완료됨</span>
        )}
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">로그</label>
          <div className="rounded-lg border border-border bg-[#0d1117] overflow-hidden">
            <div className="overflow-y-auto max-h-[300px] p-0 font-mono text-[11px] leading-[1.7]">
              {logs.map((line, i) => (
                <div key={i} className="px-3 py-0.5 hover:bg-white/[0.03] text-zinc-400">
                  <span className="text-zinc-600 select-none mr-3 inline-block w-5 text-right">{i + 1}</span>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
