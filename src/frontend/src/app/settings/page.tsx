"use client";

import { Save, Loader2, Plus, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import type { WorkerMode } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";

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
    <PageLayout className="max-w-2xl mx-auto">
      <PageHeader title="Settings">
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={cn(
            isDirty
              ? "filter-pill active flex items-center gap-1"
              : "filter-pill flex items-center gap-1 opacity-50 pointer-events-none"
          )}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        <div className="space-y-4">

          {/* API Section */}
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value="Orchestration" readOnly className="cursor-default" />
              <p className="text-xs text-muted-foreground/60 font-mono">
                sdadaniel/orchestation
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={draft.apiKey}
                onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-ant-api03-..."
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground/60">
                Anthropic API key for orchestrate.sh and Night Worker
              </p>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Select
                value={draft.model}
                onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
              >
                <option value="claude-haiku-4-5-20251001">claude-haiku-4.5</option>
                <option value="claude-sonnet-4-6">claude-sonnet-4.6</option>
                <option value="claude-opus-4-6">claude-opus-4.6</option>
              </Select>
            </div>
          </div>

          {/* Source Paths */}
          <div className="space-y-4">
            <Label size="section">Source Paths</Label>

            <div className="space-y-2">
              {draft.srcPaths.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={p}
                    onChange={(e) => {
                      const next = [...draft.srcPaths];
                      next[i] = e.target.value;
                      setDraft((prev) => ({ ...prev, srcPaths: next }));
                    }}
                    className="font-mono flex-1"
                    placeholder="src/"
                  />
                  {draft.srcPaths.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDraft((prev) => ({ ...prev, srcPaths: prev.srcPaths.filter((_, j) => j !== i) }))}
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
                onClick={() => setDraft((prev) => ({ ...prev, srcPaths: [...prev.srcPaths, ""] }))}
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Path</span>
              </Button>
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <Label size="section">Configuration</Label>

            {/* Worker Mode */}
            <div className="space-y-1.5">
              <Label>Worker mode</Label>
              <Select
                value={draft.workerMode}
                onChange={(e) => setDraft((prev) => ({ ...prev, workerMode: e.target.value as WorkerMode }))}
              >
                <option value="background">background</option>
                <option value="iterm">iterm</option>
              </Select>
            </div>

            {/* Max Parallel Tasks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max parallel tasks</Label>
                <span className="text-sm text-foreground tabular-nums">{draft.maxParallel}</span>
              </div>
              <Slider
                min={1}
                max={10}
                value={draft.maxParallel}
                onChange={(v) => setDraft((prev) => ({ ...prev, maxParallel: v }))}
              />
            </div>

            {/* Max Review Retry */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max review retry</Label>
                <span className="text-sm text-foreground tabular-nums">{draft.maxReviewRetry}</span>
              </div>
              <Slider
                min={0}
                max={5}
                value={draft.maxReviewRetry}
                onChange={(v) => setDraft((prev) => ({ ...prev, maxReviewRetry: v }))}
              />
            </div>
          </div>

        </div>
      )}
    </PageLayout>
  );
}
