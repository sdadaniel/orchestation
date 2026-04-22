import fs from "fs";
import path from "path";
import { CONFIG_PATH } from "./paths";

export type WorkerMode = "background" | "iterm";

export interface NightWorkerSettings {
  until: string;
  budget: number | null;
  maxTasks: number;
  types: string;
}

export interface Settings {
  apiKey: string;
  srcPaths: string[];
  model: string;
  baseBranch: string;
  maxParallel: number;
  maxReviewRetry: number;
  workerMode: WorkerMode;
  nightWorker: NightWorkerSettings;
}

const DEFAULTS: Settings = {
  apiKey: "",
  srcPaths: ["src/"],
  model: "claude-sonnet-4-6",
  baseBranch: "main",
  maxParallel: 3,
  maxReviewRetry: 2,
  workerMode: "background",
  nightWorker: {
    until: "07:00",
    budget: null,
    maxTasks: 10,
    types: "typecheck,lint,review",
  },
};

function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadSettings(): Settings {
  const configPath = getConfigPath();
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      apiKey:
        typeof parsed.apiKey === "string" ? parsed.apiKey : DEFAULTS.apiKey,
      srcPaths: Array.isArray(parsed.srcPaths)
        ? parsed.srcPaths
        : DEFAULTS.srcPaths,
      model: typeof parsed.model === "string" ? parsed.model : DEFAULTS.model,
      baseBranch:
        typeof parsed.baseBranch === "string"
          ? parsed.baseBranch
          : DEFAULTS.baseBranch,
      maxParallel:
        typeof parsed.maxParallel === "number" && parsed.maxParallel >= 1
          ? Math.floor(parsed.maxParallel)
          : DEFAULTS.maxParallel,
      maxReviewRetry:
        typeof parsed.maxReviewRetry === "number" && parsed.maxReviewRetry >= 0
          ? Math.floor(parsed.maxReviewRetry)
          : DEFAULTS.maxReviewRetry,
      workerMode:
        parsed.workerMode === "iterm" || parsed.workerMode === "background"
          ? parsed.workerMode
          : DEFAULTS.workerMode,
      nightWorker: {
        until: parsed.nightWorker?.until || DEFAULTS.nightWorker.until,
        budget: parsed.nightWorker?.budget ?? DEFAULTS.nightWorker.budget,
        maxTasks: parsed.nightWorker?.maxTasks || DEFAULTS.nightWorker.maxTasks,
        types: parsed.nightWorker?.types || DEFAULTS.nightWorker.types,
      },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Partial<Settings>): Settings {
  const current = loadSettings();
  const updated: Settings = {
    apiKey:
      typeof settings.apiKey === "string" ? settings.apiKey : current.apiKey,
    srcPaths: Array.isArray(settings.srcPaths)
      ? settings.srcPaths
      : current.srcPaths,
    model: typeof settings.model === "string" ? settings.model : current.model,
    baseBranch:
      typeof settings.baseBranch === "string"
        ? settings.baseBranch
        : current.baseBranch,
    maxParallel:
      typeof settings.maxParallel === "number" && settings.maxParallel >= 1
        ? Math.floor(settings.maxParallel)
        : current.maxParallel,
    maxReviewRetry:
      typeof settings.maxReviewRetry === "number" &&
      settings.maxReviewRetry >= 0
        ? Math.floor(settings.maxReviewRetry)
        : current.maxReviewRetry,
    workerMode:
      settings.workerMode === "iterm" || settings.workerMode === "background"
        ? settings.workerMode
        : current.workerMode,
    nightWorker: settings.nightWorker
      ? { ...current.nightWorker, ...settings.nightWorker }
      : current.nightWorker,
  };

  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    configPath,
    JSON.stringify(updated, null, 2) + "\n",
    "utf-8",
  );
  return updated;
}
