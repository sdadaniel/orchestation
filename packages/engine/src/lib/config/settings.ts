import fs from "fs";
import path from "path";
import { CONFIG_DEFAULT_PATH, CONFIG_PATH } from "./paths";

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
  orchestrateLogRetentionDays: number;
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
  orchestrateLogRetentionDays: 7,
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

/** `parsed` JSON을 `fallback` 기준으로 `Settings` 형태로 정규화한다. */
function normalizeSettings(parsed: unknown, fallback: Settings): Settings {
  if (!parsed || typeof parsed !== "object") {
    return { ...fallback };
  }
  const p = parsed as Record<string, unknown>;
  const nw = p.nightWorker;
  const nwObj =
    nw && typeof nw === "object"
      ? (nw as Record<string, unknown>)
      : undefined;
  return {
    apiKey: typeof p.apiKey === "string" ? p.apiKey : fallback.apiKey,
    srcPaths: Array.isArray(p.srcPaths) ? p.srcPaths : fallback.srcPaths,
    model: typeof p.model === "string" ? p.model : fallback.model,
    baseBranch:
      typeof p.baseBranch === "string" ? p.baseBranch : fallback.baseBranch,
    maxParallel:
      typeof p.maxParallel === "number" && p.maxParallel >= 1
        ? Math.floor(p.maxParallel)
        : fallback.maxParallel,
    maxReviewRetry:
      typeof p.maxReviewRetry === "number" && p.maxReviewRetry >= 0
        ? Math.floor(p.maxReviewRetry)
        : fallback.maxReviewRetry,
    orchestrateLogRetentionDays:
      typeof p.orchestrateLogRetentionDays === "number" &&
      p.orchestrateLogRetentionDays >= 1
        ? Math.floor(p.orchestrateLogRetentionDays)
        : fallback.orchestrateLogRetentionDays,
    workerMode:
      p.workerMode === "iterm" || p.workerMode === "background"
        ? p.workerMode
        : fallback.workerMode,
    nightWorker: {
      until:
        (typeof nwObj?.until === "string" ? nwObj.until : "") ||
        fallback.nightWorker.until,
      budget:
        nwObj && "budget" in nwObj
          ? nwObj.budget === null || typeof nwObj.budget === "number"
            ? (nwObj.budget as number | null)
            : fallback.nightWorker.budget
          : fallback.nightWorker.budget,
      maxTasks:
        typeof nwObj?.maxTasks === "number"
          ? nwObj.maxTasks || fallback.nightWorker.maxTasks
          : fallback.nightWorker.maxTasks,
      types:
        (typeof nwObj?.types === "string" ? nwObj.types : "") ||
        fallback.nightWorker.types,
    },
  };
}

/**
 * 리포 루트 `config-default.json`에서 기본 설정을 읽는다.
 * 파일이 없거나 깨지면 인코드된 `DEFAULTS`를 쓴다.
 */
export function loadRepoDefaultSettings(): Settings {
  try {
    if (!fs.existsSync(CONFIG_DEFAULT_PATH)) {
      return { ...DEFAULTS };
    }
    const raw = fs.readFileSync(CONFIG_DEFAULT_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed, DEFAULTS);
  } catch {
    return { ...DEFAULTS };
  }
}

export function loadSettings(): Settings {
  const repoDefaults = loadRepoDefaultSettings();
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { ...repoDefaults };
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed, repoDefaults);
  } catch {
    return { ...repoDefaults };
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
    orchestrateLogRetentionDays:
      typeof settings.orchestrateLogRetentionDays === "number" &&
      settings.orchestrateLogRetentionDays >= 1
        ? Math.floor(settings.orchestrateLogRetentionDays)
        : current.orchestrateLogRetentionDays,
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

