"use client";

import { Settings, Save, Cpu, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";

interface AppSettings {
  maxParallel: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AppSettings>({ maxParallel: 3 });
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

  const isDirty = settings !== null && draft.maxParallel !== settings.maxParallel;

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
