"use client";

import { Save, Loader2, Plus, X, Eye, EyeOff } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import type { WorkerMode } from "@/lib/config/settings";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";
import { FieldRow } from "@/components/ui/FieldRow";
import { SettingSection } from "@/components/ui/SettingSection";
import type { AppSettings } from "./types";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const out = value.filter((v): v is string => typeof v === "string");
  return out.length > 0 ? out : fallback;
}

function isWorkerMode(value: unknown): value is WorkerMode {
  return value === "background" || value === "iterm";
}

function toFormSettings(data: Record<string, unknown>): AppSettings {
  const engineConfigReloadRaw = data.engineConfigReload;
  const engineConfigReload =
    engineConfigReloadRaw &&
    typeof engineConfigReloadRaw === "object" &&
    !Array.isArray(engineConfigReloadRaw) &&
    typeof (engineConfigReloadRaw as { reloaded?: unknown }).reloaded === "boolean"
      ? {
          reloaded: (engineConfigReloadRaw as { reloaded: boolean }).reloaded,
          reason: asString((engineConfigReloadRaw as { reason?: unknown }).reason),
        }
      : null;

  const workerModeRaw = data.workerMode;
  const workerMode: WorkerMode = isWorkerMode(workerModeRaw)
    ? workerModeRaw
    : "background";

  return {
    apiKey: asString(data.apiKey, ""),
    srcPaths: asStringArray(data.srcPaths, [""]),
    model: asString(data.model, "claude-sonnet-4-6"),
    baseBranch: asString(data.baseBranch, "main"),
    maxParallel: Math.max(1, Math.floor(asFiniteNumber(data.maxParallel, 3))),
    maxReviewRetry: Math.max(0, Math.floor(asFiniteNumber(data.maxReviewRetry, 2))),
    orchestrateLogRetentionDays: Math.max(
      1,
      Math.floor(asFiniteNumber(data.orchestrateLogRetentionDays, 7)),
    ),
    workerMode,
    engineConfigReload,
  };
}

export default function SettingsPageView() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const { addToast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const form = toFormSettings(data);
        setSettings(form);
        setDraft(form);
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
    if (draft === null) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const raw = (await res.json()) as Record<string, unknown>;
        const updated = toFormSettings(raw);
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

  const isDirty =
    settings !== null &&
    draft !== null &&
    JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <PageLayout className="max-w-2xl mx-auto">
      <PageHeader title="Settings">
        <Button
          onClick={handleSave}
          disabled={!isDirty || saving}
          variant={isDirty ? "default" : "ghost"}
          size="sm"
          className="flex items-center gap-1"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : draft === null ? (
        <div className="text-sm text-muted-foreground">No settings loaded.</div>
      ) : (
        <div className="space-y-4">
          {/* API Section */}
          <SettingSection title="API Configuration">
            <FieldRow label="Name" description="sdadaniel/orchestation">
              <Input
                value="Orchestration"
                readOnly
                className="cursor-default font-mono"
              />
            </FieldRow>

            <FieldRow
              label="API Key"
              htmlFor="apiKey"
              description="Anthropic API key for Orchestrate Engine and Night Worker"
            >
              <div className="flex items-center gap-2">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  value={draft.apiKey}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, apiKey: e.target.value } : prev,
                    )
                  }
                  placeholder="sk-ant-api03-..."
                  className="font-mono flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </FieldRow>

            <FieldRow label="Model">
              <Select
                value={draft.model}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev ? { ...prev, model: e.target.value } : prev,
                  )
                }
              >
                <option value="claude-haiku-4-5-20251001">
                  claude-haiku-4.5
                </option>
                <option value="claude-sonnet-4-6">claude-sonnet-4.6</option>
                <option value="claude-opus-4-6">claude-opus-4.6</option>
              </Select>
            </FieldRow>

            <FieldRow
              label="Base branch"
              description="Default branch for pull requests and base comparisons"
            >
              <Input
                value={draft.baseBranch}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev ? { ...prev, baseBranch: e.target.value } : prev,
                  )
                }
                placeholder="main"
                className="font-mono"
              />
            </FieldRow>
          </SettingSection>

          {/* Source Paths */}
          <SettingSection title="Source Paths">
            <div className="space-y-2">
              {draft.srcPaths.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={p}
                    onChange={(e) => {
                      const next = [...draft.srcPaths];
                      next[i] = e.target.value;
                      setDraft((prev) =>
                        prev ? { ...prev, srcPaths: next } : prev,
                      );
                    }}
                    className="font-mono flex-1"
                    placeholder="src/"
                  />
                  {draft.srcPaths.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                srcPaths: prev.srcPaths.filter((_, j) => j !== i),
                              }
                            : prev,
                        )
                      }
                      className="text-muted-foreground hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setDraft((prev) =>
                    prev
                      ? { ...prev, srcPaths: [...prev.srcPaths, ""] }
                      : prev,
                  )
                }
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Path</span>
              </Button>
            </div>
          </SettingSection>

          {/* Configuration */}
          <SettingSection title="Configuration">
            <FieldRow label="Worker mode">
              <Select
                value={draft.workerMode}
                onChange={(e) =>
                  setDraft((prev) => {
                    if (!prev) return prev;
                    const next = e.target.value;
                    return {
                      ...prev,
                      workerMode: isWorkerMode(next) ? next : prev.workerMode,
                    };
                  })
                }
              >
                <option value="background">background</option>
                <option value="iterm">iterm</option>
              </Select>
            </FieldRow>

            {/* Max Parallel Tasks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max parallel tasks</Label>
                <span className="text-sm text-foreground tabular-nums">
                  {draft.maxParallel}
                </span>
              </div>
              <Slider
                min={1}
                max={10}
                value={draft.maxParallel}
                onChange={(v) =>
                  setDraft((prev) => (prev ? { ...prev, maxParallel: v } : prev))
                }
              />
            </div>

            {/* Max Review Retry */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max review retry</Label>
                <span className="text-sm text-foreground tabular-nums">
                  {draft.maxReviewRetry}
                </span>
              </div>
              <Slider
                min={0}
                max={5}
                value={draft.maxReviewRetry}
                onChange={(v) =>
                  setDraft((prev) =>
                    prev ? { ...prev, maxReviewRetry: v } : prev,
                  )
                }
              />
            </div>

            <FieldRow
              label="Orchestrate log retention (days)"
              htmlFor="orchestrateLogRetentionDays"
              description="Delete orchestrate log files older than this number of days"
            >
              <Input
                id="orchestrateLogRetentionDays"
                type="number"
                min={1}
                max={365}
                value={draft.orchestrateLogRetentionDays}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          orchestrateLogRetentionDays: Math.max(
                            1,
                            Number.parseInt(e.target.value || "1", 10) || 1,
                          ),
                        }
                      : prev,
                  )
                }
                className="font-mono"
              />
            </FieldRow>
          </SettingSection>
        </div>
      )}
    </PageLayout>
  );
}
