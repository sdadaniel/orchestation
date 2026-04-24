import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "../../lib/config/paths";
import type { SseEventEnvelope } from "../types";

const SSE_DIR = path.join(PROJECT_ROOT, ".orchestration", "sse");
const META_PATH = path.join(SSE_DIR, "meta.json");
const RETENTION_DAYS = 7;

type Meta = { lastId: number };

function ensureDir() {
  fs.mkdirSync(SSE_DIR, { recursive: true });
}

function isoDay(d: Date): string {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function filePathForDay(day: string): string {
  return path.join(SSE_DIR, `${day}.jsonl`);
}

function readMeta(): Meta {
  try {
    const raw = fs.readFileSync(META_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Meta>;
    const lastId = typeof parsed.lastId === "number" && Number.isFinite(parsed.lastId)
      ? parsed.lastId
      : 0;
    return { lastId };
  } catch {
    return { lastId: 0 };
  }
}

function writeMeta(meta: Meta) {
  fs.writeFileSync(META_PATH, JSON.stringify(meta), "utf-8");
}

let lastCleanupAtMs = 0;
function cleanupOldFiles(now: Date) {
  const nowMs = now.getTime();
  if (nowMs - lastCleanupAtMs < 60 * 60 * 1000) return; // at most once/hour
  lastCleanupAtMs = nowMs;

  try {
    ensureDir();
    const files = fs.readdirSync(SSE_DIR);
    const cutoffMs = nowMs - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const f of files) {
      const m = f.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
      if (!m) continue;
      const day = m[1];
      const t = new Date(`${day}T00:00:00.000Z`).getTime();
      if (Number.isFinite(t) && t < cutoffMs) {
        try {
          fs.unlinkSync(path.join(SSE_DIR, f));
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
  private meta: Meta;

  constructor() {
    ensureDir();
    this.meta = readMeta();
    // Ensure meta file exists
    writeMeta(this.meta);
  }

  nextId(): number {
    this.meta.lastId += 1;
    writeMeta(this.meta);
    return this.meta.lastId;
  }

  append<T>(type: string, data: T, at: Date = new Date()): SseEventEnvelope<T> {
    ensureDir();
    cleanupOldFiles(at);

    const env: SseEventEnvelope<T> = {
      id: this.nextId(),
      atIso: at.toISOString(),
      type: type as any,
      data,
    };

    const day = isoDay(at);
    const fp = filePathForDay(day);
    fs.appendFileSync(fp, `${JSON.stringify(env)}\n`, "utf-8");
    return env;
  }

  /**
   * Read events strictly after `afterId` (exclusive), in ascending order.
   * This scans the retained day files (7 days) and returns up to `limit` events.
   */
  readAfter(afterId: number, limit: number): SseEventEnvelope[] {
    ensureDir();
    const out: SseEventEnvelope[] = [];

    const files = fs
      .readdirSync(SSE_DIR)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .sort(); // day ascending

    for (const f of files) {
      const fp = path.join(SSE_DIR, f);
      let raw = "";
      try {
        raw = fs.readFileSync(fp, "utf-8");
      } catch {
        continue;
      }
      const lines = raw.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const env = JSON.parse(line) as SseEventEnvelope;
          if (typeof env?.id !== "number") continue;
          if (env.id <= afterId) continue;
          out.push(env);
          if (out.length >= limit) return out;
        } catch {
          // ignore bad line
        }
      }
    }

    return out;
  }
}

export const fileEventStore = new FileEventStore();

