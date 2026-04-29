import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "../../lib/config/paths";
import type { BusEventEnvelope } from "../types";
import { randomUUID } from "crypto";

const EVENTS_DIR = path.join(PROJECT_ROOT, ".orchestration", "events");
const RETENTION_DAYS = 7;

function ensureDir() {
  fs.mkdirSync(EVENTS_DIR, { recursive: true });
}

function isoDay(d: Date): string {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function filePathForDay(day: string): string {
  return path.join(EVENTS_DIR, `${day}.jsonl`);
}

let lastCleanupAtMs = 0;
function cleanupOldFiles(now: Date) {
  const nowMs = now.getTime();
  if (nowMs - lastCleanupAtMs < 60 * 60 * 1000) return; // at most once/hour
  lastCleanupAtMs = nowMs;

  try {
    ensureDir();
    const files = fs.readdirSync(EVENTS_DIR);
    const cutoffMs = nowMs - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const f of files) {
      const m = f.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
      if (!m) continue;
      const day = m[1];
      const t = new Date(`${day}T00:00:00.000Z`).getTime();
      if (Number.isFinite(t) && t < cutoffMs) {
        try {
          fs.unlinkSync(path.join(EVENTS_DIR, f));
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

export class FileEventStore {
  constructor() {
    ensureDir();
  }

  append<T>(type: string, data: T, at: Date = new Date()): BusEventEnvelope<T> {
    ensureDir();
    cleanupOldFiles(at);

    const env: BusEventEnvelope<T> = {
      id: randomUUID(),
      atIso: at.toISOString(),
      type: type as any,
      data,
    };

    const day = isoDay(at);
    const fp = filePathForDay(day);
    fs.appendFileSync(fp, `${JSON.stringify(env)}\n`, "utf-8");
    return env;
  }

  appendRaw(env: BusEventEnvelope): void {
    const at = new Date(env.atIso);
    ensureDir();
    cleanupOldFiles(at);
    const day = isoDay(at);
    const fp = filePathForDay(day);
    fs.appendFileSync(fp, `${JSON.stringify(env)}\n`, "utf-8");
  }
}

export const fileEventStore = new FileEventStore();

