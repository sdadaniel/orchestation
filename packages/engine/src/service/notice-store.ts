import crypto from "crypto";
import { getDb, getWritableDb } from "./db";
import { formatTimestamp } from "../lib/time/date-utils";
import type { NoticeData, NoticeType } from "../parser/notice-parser";

type NoticeRow = {
  id: string;
  display_id: string | null;
  display_number: number | null;
  legacy_notice_key: string | null;
  title: string | null;
  content: string | null;
  type: string | null;
  read: number | null;
  created: string | null;
  updated: string | null;
};

const VALID_NOTICE_TYPES = new Set<NoticeType>([
  "info",
  "warning",
  "error",
  "request",
]);

function nowDate(): string {
  return formatTimestamp(new Date()).slice(0, 10);
}

function toNoticeType(value: string | null | undefined): NoticeType {
  return VALID_NOTICE_TYPES.has(value as NoticeType)
    ? (value as NoticeType)
    : "info";
}

export function formatNoticeDisplayId(displayNumber: number): string {
  return `NOTICE-${String(displayNumber).padStart(3, "0")}`;
}

function parseNoticeDisplayNumber(value: string): number | null {
  const match = value.match(/^NOTICE-(\d+)$/i);
  if (!match) return null;
  const parsed = parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveNoticeRef(id: string): NoticeRow | null {
  const db = getDb();
  if (!db) return null;

  const byId = db
    .prepare("SELECT * FROM notices WHERE id = ?")
    .get(id) as NoticeRow | undefined;
  if (byId) return byId;

  const byDisplay = db
    .prepare("SELECT * FROM notices WHERE display_id = ?")
    .get(id) as NoticeRow | undefined;
  if (byDisplay) return byDisplay;

  const byLegacy = db
    .prepare("SELECT * FROM notices WHERE legacy_notice_key = ?")
    .get(id) as NoticeRow | undefined;
  if (byLegacy) return byLegacy;

  return null;
}

export function getNoticeLookupKeys(
  value: string | Pick<NoticeData, "id" | "display_id">,
): string[] {
  const row =
    typeof value === "string" ? resolveNoticeRef(value) : resolveNoticeRef(value.id);
  if (!row) {
    const raw = typeof value === "string" ? value : value.id;
    const display = typeof value === "string" ? undefined : value.display_id;
    return [...new Set([raw, display].filter((entry): entry is string => !!entry))];
  }

  return [
    ...new Set(
      [row.id, row.display_id, row.legacy_notice_key].filter(
        (entry): entry is string => typeof entry === "string" && entry.length > 0,
      ),
    ),
  ];
}

function rowToNotice(row: NoticeRow): NoticeData {
  return {
    id: row.id,
    display_id: row.display_id || row.legacy_notice_key || row.id,
    title: row.title ?? "",
    type: toNoticeType(row.type),
    read: Boolean(row.read),
    created: row.created ?? "",
    updated: row.updated ?? row.created ?? "",
    content: row.content ?? "",
  };
}

export function getAllNotices(): NoticeData[] {
  const db = getDb();
  if (!db) return [];

  const rows = db
    .prepare(
      "SELECT * FROM notices ORDER BY COALESCE(display_number, 2147483647) DESC, display_id DESC, id DESC",
    )
    .all() as NoticeRow[];

  return rows.map(rowToNotice);
}

export function getNotice(id: string): NoticeData | null {
  const row = resolveNoticeRef(id);
  return row ? rowToNotice(row) : null;
}

export function getNextNoticeDisplayId(): string {
  const db = getDb();
  if (!db) return "NOTICE-001";
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(display_number), 0) AS max_display_number FROM notices",
    )
    .get() as { max_display_number?: number | null } | undefined;
  return formatNoticeDisplayId((row?.max_display_number ?? 0) + 1);
}

export function createNotice(input: {
  title: string;
  content: string;
  type: NoticeType;
  read?: boolean;
  display_id?: string;
  legacy_notice_key?: string | null;
}): NoticeData {
  const db = getWritableDb();
  if (!db) throw new Error("Database not available");

  const canonicalId = crypto.randomUUID();
  const displayId = input.display_id?.trim() || getNextNoticeDisplayId();
  const displayNumber =
    parseNoticeDisplayNumber(displayId) ??
    parseNoticeDisplayNumber(getNextNoticeDisplayId()) ??
    1;
  const created = nowDate();
  const updated = created;

  db.prepare(
    `INSERT INTO notices
      (id, display_id, display_number, legacy_notice_key, title, content, type, read, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    canonicalId,
    displayId,
    displayNumber,
    input.legacy_notice_key ?? null,
    input.title.trim(),
    input.content.trim(),
    input.type,
    input.read ? 1 : 0,
    created,
    updated,
  );

  return getNotice(canonicalId)!;
}

export function updateNotice(
  id: string,
  updates: Partial<Pick<NoticeData, "title" | "content" | "type" | "read">>,
): NoticeData | null {
  const db = getWritableDb();
  if (!db) return null;
  const row = resolveNoticeRef(id);
  if (!row) return null;

  const sets: string[] = [];
  const values: Record<string, unknown> = {
    id: row.id,
    updated: nowDate(),
  };

  if (typeof updates.title === "string") {
    sets.push("title = @title");
    values.title = updates.title.trim();
  }
  if (typeof updates.content === "string") {
    sets.push("content = @content");
    values.content = updates.content.trim();
  }
  if (typeof updates.type === "string") {
    sets.push("type = @type");
    values.type = toNoticeType(updates.type);
  }
  if (typeof updates.read === "boolean") {
    sets.push("read = @read");
    values.read = updates.read ? 1 : 0;
  }

  sets.push("updated = @updated");
  db.prepare(`UPDATE notices SET ${sets.join(", ")} WHERE id = @id`).run(values);

  return getNotice(row.id);
}

export function deleteNotice(id: string): boolean {
  const db = getWritableDb();
  if (!db) return false;
  const row = resolveNoticeRef(id);
  if (!row) return false;
  const result = db.prepare("DELETE FROM notices WHERE id = ?").run(row.id);
  return result.changes > 0;
}
