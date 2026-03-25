import fs from "fs";
import path from "path";

export type WorkerMode = "background" | "iterm";

export interface Settings {
  maxParallel: number;
  workerMode: WorkerMode;
  claudeApiKey: string;
}

const DEFAULTS: Settings = {
  maxParallel: 3,
  workerMode: "background",
  claudeApiKey: "",
};

function getConfigPath(): string {
  const projectRoot = path.resolve(process.cwd(), "..", "..");
  return path.join(projectRoot, "config.json");
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

/** masked 값인지 판별 (xxxx...xxxx 패턴) */
function isMaskedKey(value: string): boolean {
  return /^.{1,8}\.\.\..*$/.test(value);
}

export function loadSettings(): Settings {
  const configPath = getConfigPath();
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      maxParallel:
        typeof parsed.maxParallel === "number" && parsed.maxParallel >= 1
          ? Math.floor(parsed.maxParallel)
          : DEFAULTS.maxParallel,
      workerMode:
        parsed.workerMode === "iterm" || parsed.workerMode === "background"
          ? parsed.workerMode
          : DEFAULTS.workerMode,
      claudeApiKey:
        typeof parsed.claudeApiKey === "string" ? parsed.claudeApiKey : DEFAULTS.claudeApiKey,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Partial<Settings>): Settings {
  const current = loadSettings();

  // claudeApiKey: masked 값이 들어오면 기존 키 유지
  let newApiKey = current.claudeApiKey;
  if (typeof settings.claudeApiKey === "string") {
    const trimmed = settings.claudeApiKey.trim();
    if (trimmed !== "" && !isMaskedKey(trimmed)) {
      newApiKey = trimmed;
    }
  }

  const updated: Settings = {
    maxParallel:
      typeof settings.maxParallel === "number" && settings.maxParallel >= 1
        ? Math.floor(settings.maxParallel)
        : current.maxParallel,
    workerMode:
      settings.workerMode === "iterm" || settings.workerMode === "background"
        ? settings.workerMode
        : current.workerMode,
    claudeApiKey: newApiKey,
  };

  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
  return updated;
}
