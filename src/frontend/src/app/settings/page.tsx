"use client";

import { Settings, Save, Cpu, Loader2, Monitor, Terminal, Key, FolderOpen, Brain, RotateCcw, Plus, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import type { WorkerMode } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface AppSettings {
  apiKey: string;
  srcPaths: string[];
  model: string;
  maxParallel: number;
  maxReviewRetry: number;
  workerMode: WorkerMode;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AppSettings>({
    apiKey: "",
    srcPaths: ["src/"],
    model: "claude-sonnet-4-6",
    maxParallel: 3,
    maxReviewRetry: 2,
    workerMode: "background",
  });
  const { addToast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setDraft(data);
      }
    } catch {
      addToast("Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setDraft(updated);
        addToast("Settings saved", "success");
      } else {
        addToast("Failed to save settings", "error");
      }
    } catch {
      addToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = settings !== null && JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">Settings</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        <div className="space-y-6">

          {/* API Key */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              API
            </h2>
            <div className="border border-border rounded-md p-4 space-y-4">
              <div className="flex items-start gap-3">
                <Key className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <label htmlFor="apiKey" className="text-xs font-medium">Claude API Key</label>
                  <input
                    id="apiKey"
                    type="password"
                    value={draft.apiKey}
                    onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="sk-ant-api03-..."
                    className="w-full rounded border border-border bg-transparent text-foreground px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Anthropic API 키. orchestrate.sh와 Night Worker가 사용합니다.
                  </p>
                </div>
              </div>

              <div className="border-t border-border" />

              <div className="flex items-start gap-3">
                <Brain className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-medium">기본 모델</label>
                  <div className="flex gap-2">
                    {["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"].map((m) => {
                      const label = m.includes("haiku") ? "Haiku" : m.includes("sonnet") ? "Sonnet" : "Opus";
                      return (
                        <button
                          key={m}
                          onClick={() => setDraft((prev) => ({ ...prev, model: m }))}
                          className={cn(
                            "px-3 py-1.5 text-[11px] rounded border transition-colors",
                            draft.model === m
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    복잡한 태스크는 자동으로 상위 모델을 사용합니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Project */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Project
            </h2>
            <div className="border border-border rounded-md p-4 space-y-4">
              <div className="flex items-start gap-3">
                <FolderOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-medium">소스 경로 (srcPaths)</label>
                  <p className="text-[11px] text-muted-foreground">
                    Claude가 스캔하고 작업할 소스 코드 경로입니다. 프로젝트 루트 기준 상대 경로.
                  </p>
                  <div className="space-y-1.5">
                    {draft.srcPaths.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={p}
                          onChange={(e) => {
                            const next = [...draft.srcPaths];
                            next[i] = e.target.value;
                            setDraft((prev) => ({ ...prev, srcPaths: next }));
                          }}
                          className="flex-1 rounded border border-border bg-transparent text-foreground px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="src/"
                        />
                        {draft.srcPaths.length > 1 && (
                          <button
                            onClick={() => setDraft((prev) => ({ ...prev, srcPaths: prev.srcPaths.filter((_, j) => j !== i) }))}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setDraft((prev) => ({ ...prev, srcPaths: [...prev.srcPaths, ""] }))}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      경로 추가
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Orchestration */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Orchestration
            </h2>
            <div className="border border-border rounded-md p-4 space-y-4">
              {/* Max Parallel */}
              <div className="flex items-start gap-3">
                <Cpu className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="maxParallel" className="text-xs font-medium">Max Parallel Tasks</label>
                    <input
                      id="maxParallel"
                      type="number"
                      min={1}
                      max={10}
                      value={draft.maxParallel}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1 && v <= 10) setDraft((prev) => ({ ...prev, maxParallel: v }));
                      }}
                      className="w-16 rounded border border-border bg-transparent text-foreground px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    동시에 실행할 수 있는 최대 태스크 수입니다.
                  </p>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setDraft((prev) => ({ ...prev, maxParallel: n }))}
                        className={cn(
                          "px-2 py-0.5 text-[11px] rounded border transition-colors",
                          draft.maxParallel === n
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Max Review Retry */}
              <div className="flex items-start gap-3">
                <RotateCcw className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="maxReviewRetry" className="text-xs font-medium">Max Review Retry</label>
                    <input
                      id="maxReviewRetry"
                      type="number"
                      min={0}
                      max={5}
                      value={draft.maxReviewRetry}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 0 && v <= 5) setDraft((prev) => ({ ...prev, maxReviewRetry: v }));
                      }}
                      className="w-16 rounded border border-border bg-transparent text-foreground px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    리뷰 실패 시 재시도 횟수. 초과하면 태스크가 failed 처리됩니다.
                  </p>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Worker Mode */}
              <div className="flex items-start gap-3">
                <Monitor className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-medium">Worker 실행 모드</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDraft((prev) => ({ ...prev, workerMode: "background" }))}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded border transition-colors",
                        draft.workerMode === "background"
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <Monitor className="h-3 w-3" />
                      백그라운드
                    </button>
                    <button
                      onClick={() => setDraft((prev) => ({ ...prev, workerMode: "iterm" }))}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded border transition-colors",
                        draft.workerMode === "iterm"
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <Terminal className="h-3 w-3" />
                      iTerm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
