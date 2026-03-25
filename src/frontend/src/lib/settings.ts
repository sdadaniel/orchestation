import fs from "fs";
import path from "path";

export type WorkerMode = "background" | "iterm";

export interface Settings {
  maxParallel: number;
  workerMode: WorkerMode;
  baseBranch: string;
}

const DEFAULTS: Settings = {
  maxParallel: 3,
  workerMode: "background",
  baseBranch: "main",
};

function getConfigPath(): string {
  const projectRoot = path.resolve(process.cwd(), "..", "..");
  return path.join(projectRoot, "config.json");
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
      baseBranch:
        typeof parsed.baseBranch === "string" && parsed.baseBranch.trim().length > 0
          ? parsed.baseBranch.trim()
          : DEFAULTS.baseBranch,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Partial<Settings>): Settings {
  const current = loadSettings();
  const updated: Settings = {
    maxParallel:
      typeof settings.maxParallel === "number" && settings.maxParallel >= 1
        ? Math.floor(settings.maxParallel)
        : current.maxParallel,
    workerMode:
      settings.workerMode === "iterm" || settings.workerMode === "background"
        ? settings.workerMode
        : current.workerMode,
    baseBranch:
      typeof settings.baseBranch === "string" && settings.baseBranch.trim().length > 0
        ? settings.baseBranch.trim()
        : current.baseBranch,
  };

  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
  return updated;
}
