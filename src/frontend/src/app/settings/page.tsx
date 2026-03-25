"use client";

import { Settings, Save, Cpu, Loader2, Monitor, Terminal, Key, Eye, EyeOff } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import type { WorkerMode } from "@/lib/settings";

interface AppSettings {
  maxParallel: number;
  workerMode: WorkerMode;
  claudeApiKey: string; // masked value from server
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AppSettings>({
    maxParallel: 3,
    workerMode: "background",
    claudeApiKey: "",
  });
  // separate state for new key input (not part of draft to avoid sending masked value back)
  const [newApiKey, setNewApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
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
    // validate new API key if provided
    if (newApiKey.trim() !== "" && newApiKey.trim().length < 8) {
      addToast("API Key가 너무 짧습니다", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...draft,
        // only send new key if user typed one; otherwise send masked (server will preserve existing)
        claudeApiKey: newApiKey.trim() !== "" ? newApiKey.trim() : draft.claudeApiKey,
      };

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setDraft(updated);
        setNewApiKey("");
        setShowApiKey(false);
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

  const isDirty =
    settings !== null &&
    (draft.maxParallel !== settings.maxParallel ||
      draft.workerMode !== settings.workerMode ||
      newApiKey.trim() !== "");

  return (
    <div className="max-w-2xl mx-auto">
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
          {/* Orchestration Section */}
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
                    <label htmlFor="maxParallel" className="text-xs font-medium">
                      Max Parallel Tasks
                    </label>
                    <input
                      id="maxParallel"
                      type="number"
                      min={1}
                      max={10}
                      value={draft.maxParallel}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1 && v <= 10) {
                          setDraft((prev) => ({ ...prev, maxParallel: v }));
                        }
                      }}
                      className="w-16 rounded border border-border bg-background px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    동시에 실행할 수 있는 최대 태스크 수입니다.
                    Claude 프로세스 하나당 약 700MB를 사용하므로,
                    시스템 메모리에 맞게 조절하세요.
                  </p>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setDraft((prev) => ({ ...prev, maxParallel: n }))}
                        className={`px-2 py-0.5 text-[11px] rounded border transition-colors ${
                          draft.maxParallel === n
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Worker Mode */}
              <div className="flex items-start gap-3">
                <Monitor className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-medium">Worker 실행 모드</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    백그라운드 모드는 iTerm 없이 조용히 실행됩니다.
                    iTerm 모드는 각 태스크를 별도 패널에서 실행합니다.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, workerMode: "background" }))
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded border transition-colors ${
                        draft.workerMode === "background"
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <Monitor className="h-3 w-3" />
                      백그라운드 실행
                    </button>
                    <button
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, workerMode: "iterm" }))
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded border transition-colors ${
                        draft.workerMode === "iterm"
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <Terminal className="h-3 w-3" />
                      iTerm 터미널 실행
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* API Section */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              API
            </h2>

            <div className="border border-border rounded-md p-4 space-y-4">
              {/* Claude API Key */}
              <div className="flex items-start gap-3">
                <Key className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-medium">Claude API Key</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Anthropic Claude API Key입니다. 오케스트레이션 실행 시{" "}
                    <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
                      ANTHROPIC_API_KEY
                    </code>{" "}
                    환경변수로 전달됩니다.
                  </p>

                  {/* Current key display */}
                  {draft.claudeApiKey && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">현재:</span>
                      <code className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded text-foreground">
                        {draft.claudeApiKey}
                      </code>
                    </div>
                  )}

                  {/* New key input */}
                  <div className="relative">
                    <input
                      id="claudeApiKey"
                      type={showApiKey ? "text" : "password"}
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder={
                        draft.claudeApiKey
                          ? "새 API Key 입력 (변경 시에만)"
                          : "sk-ant-..."
                      }
                      autoComplete="off"
                      className="w-full rounded border border-border bg-background px-3 py-1.5 pr-9 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono placeholder:font-sans placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  {newApiKey.trim() !== "" && newApiKey.trim().length < 8 && (
                    <p className="text-[11px] text-destructive">
                      API Key가 너무 짧습니다.
                    </p>
                  )}
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
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
