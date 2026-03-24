import fs from "fs";
import path from "path";

export interface Settings {
  maxParallel: number;
}

const DEFAULTS: Settings = {
  maxParallel: 3,
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
      maxParallel: typeof parsed.maxParallel === "number" && parsed.maxParallel >= 1
        ? Math.floor(parsed.maxParallel)
        : DEFAULTS.maxParallel,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Partial<Settings>): Settings {
  const current = loadSettings();
  const updated: Settings = {
    maxParallel: typeof settings.maxParallel === "number" && settings.maxParallel >= 1
      ? Math.floor(settings.maxParallel)
      : current.maxParallel,
  };

  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
  return updated;
}
