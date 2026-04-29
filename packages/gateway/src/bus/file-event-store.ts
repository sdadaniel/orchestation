import fs from "fs";
import path from "path";
import type { BusEventEnvelope, BusEventType } from "@orchestration/bus-types";
import { randomUUID } from "crypto";
import { PROJECT_ROOT } from "@/lib/config/paths";

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

function listDayFilesDesc(): string[] {
  try {
    ensureDir();
    return fs
      .readdirSync(EVENTS_DIR)
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(file))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

let lastCleanupAtMs = 0;

function cleanupOldFiles(now: Date) {
  const nowMs = now.getTime();
  if (nowMs - lastCleanupAtMs < 60 * 60 * 1000) return;
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

class FileEventStore {
  constructor() {
    ensureDir();
  }

  append<T>(type: BusEventType, data: T, at: Date = new Date()): BusEventEnvelope<T> {
    ensureDir();
    cleanupOldFiles(at);

    const env: BusEventEnvelope<T> = {
      id: randomUUID(),
      atIso: at.toISOString(),
      type,
      data,
    };

    const fp = filePathForDay(isoDay(at));
    fs.appendFileSync(fp, `${JSON.stringify(env)}\n`, "utf-8");
    return env;
  }

  appendRaw(env: BusEventEnvelope): void {
    const at = new Date(env.atIso);
    ensureDir();
    cleanupOldFiles(at);
    const fp = filePathForDay(isoDay(at));
    fs.appendFileSync(fp, `${JSON.stringify(env)}\n`, "utf-8");
  }

  readLatest(type: BusEventType): BusEventEnvelope | null {
    for (const file of listDayFilesDesc()) {
      try {
        const lines = fs
          .readFileSync(path.join(EVENTS_DIR, file), "utf-8")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        for (let i = lines.length - 1; i >= 0; i--) {
          const parsed = JSON.parse(lines[i]!) as BusEventEnvelope;
          if (parsed.type === type) {
            return parsed;
          }
        }
      } catch {
        /* ignore */
      }
    }

    return null;
  }

  readRecent(type: BusEventType, limit: number): BusEventEnvelope[] {
    const collected: BusEventEnvelope[] = [];
    const capped = Math.max(1, limit);

    for (const file of listDayFilesDesc()) {
      try {
        const lines = fs
          .readFileSync(path.join(EVENTS_DIR, file), "utf-8")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        for (let i = lines.length - 1; i >= 0 && collected.length < capped; i--) {
          const parsed = JSON.parse(lines[i]!) as BusEventEnvelope;
          if (parsed.type === type) {
            collected.push(parsed);
          }
        }
      } catch {
        /* ignore */
      }

      if (collected.length >= capped) break;
    }

    return collected.reverse();
  }
}

export const fileEventStore = new FileEventStore();
