import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs", () => {
  const mod = {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(""),
    readdirSync: vi.fn().mockReturnValue([]),
  };
  return { default: mod, ...mod };
});

import * as fs from "fs";
import {
  parseNoticeFile,
  parseAllNotices,
  findNoticeFile,
  getNoticesDir,
} from "../parser/notice-parser";

const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
const mockReaddirSync = fs.readdirSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue("");
  mockReaddirSync.mockReturnValue([]);
});

const VALID_NOTICE_MD = `---
id: NOTICE-001
title: System Update
type: info
read: false
created: 2026-03-27
updated: 2026-03-27
---
This is the notice body.`;

const WARNING_NOTICE_MD = `---
id: NOTICE-002
title: Low Disk
type: warning
read: true
created: 2026-03-26
---
Disk usage is high.`;

// ──────────────────────────────────────────────────────────────
// parseNoticeFile
// ──────────────────────────────────────────────────────────────
describe("parseNoticeFile", () => {
  it("parses a valid notice file", () => {
    mockReadFileSync.mockReturnValue(VALID_NOTICE_MD);

    const notice = parseNoticeFile("/notices/NOTICE-001.md");
    expect(notice).not.toBeNull();
    expect(notice!.id).toBe("NOTICE-001");
    expect(notice!.title).toBe("System Update");
    expect(notice!.type).toBe("info");
    expect(notice!.read).toBe(false);
    expect(notice!.created).toBe("2026-03-27");
    expect(notice!.updated).toBe("2026-03-27");
    expect(notice!.content).toBe("This is the notice body.");
  });

  it("parses a warning notice", () => {
    mockReadFileSync.mockReturnValue(WARNING_NOTICE_MD);

    const notice = parseNoticeFile("/notices/NOTICE-002.md");
    expect(notice!.type).toBe("warning");
    expect(notice!.read).toBe(true);
  });

  it("returns null for empty file", () => {
    mockReadFileSync.mockReturnValue("");
    expect(parseNoticeFile("/notices/empty.md")).toBeNull();
  });

  it("returns null when readFileSync throws", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(parseNoticeFile("/notices/nonexistent.md")).toBeNull();
  });

  it("falls back to 'info' for unknown notice type", () => {
    mockReadFileSync.mockReturnValue(`---
id: NOTICE-X
title: Test
type: critical
created: 2026-01-01
---
Body`);
    const notice = parseNoticeFile("/notices/NOTICE-X.md");
    expect(notice!.type).toBe("info");
  });

  it("falls back to id derived from filename when id field missing", () => {
    mockReadFileSync.mockReturnValue(`---
title: No ID Field
type: info
created: 2026-01-01
---
Body`);
    const notice = parseNoticeFile("/notices/NOTICE-007.md");
    expect(notice!.id).toBe("NOTICE-007");
  });

  it("sets updated to created when updated field is absent", () => {
    mockReadFileSync.mockReturnValue(`---
id: NOTICE-003
title: T
type: request
created: 2026-03-01
---
`);
    const notice = parseNoticeFile("/notices/NOTICE-003.md");
    expect(notice!.updated).toBe("2026-03-01");
  });

  it("accepts all valid notice types", () => {
    const types = ["info", "warning", "error", "request"] as const;
    for (const t of types) {
      mockReadFileSync.mockReturnValue(
        `---\nid: N\ntitle: T\ntype: ${t}\ncreated: 2026-01-01\n---\n`,
      );
      expect(parseNoticeFile("/n.md")!.type).toBe(t);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// parseAllNotices
// ──────────────────────────────────────────────────────────────
describe("parseAllNotices", () => {
  it("returns empty array when notices directory does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(parseAllNotices()).toEqual([]);
  });

  it("returns empty array when directory is empty", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    expect(parseAllNotices()).toEqual([]);
  });

  it("ignores files not matching NOTICE-*.md pattern", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      "README.md",
      "other-file.md",
      "NOTICE-001.md",
    ]);
    mockReadFileSync.mockReturnValue(VALID_NOTICE_MD);

    const notices = parseAllNotices();
    expect(notices).toHaveLength(1);
  });

  it("parses multiple notice files", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["NOTICE-001.md", "NOTICE-002.md"]);
    mockReadFileSync
      .mockReturnValueOnce(VALID_NOTICE_MD)
      .mockReturnValueOnce(WARNING_NOTICE_MD);

    const notices = parseAllNotices();
    expect(notices).toHaveLength(2);
  });

  it("sorts notices newest ID first", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      "NOTICE-001.md",
      "NOTICE-003.md",
      "NOTICE-002.md",
    ]);
    mockReadFileSync
      .mockReturnValueOnce(
        `---\nid: NOTICE-001\ntitle: T1\ntype: info\ncreated: 2026-01-01\n---\n`,
      )
      .mockReturnValueOnce(
        `---\nid: NOTICE-003\ntitle: T3\ntype: info\ncreated: 2026-01-03\n---\n`,
      )
      .mockReturnValueOnce(
        `---\nid: NOTICE-002\ntitle: T2\ntype: info\ncreated: 2026-01-02\n---\n`,
      );

    const notices = parseAllNotices();
    expect(notices[0].id).toBe("NOTICE-003");
    expect(notices[1].id).toBe("NOTICE-002");
    expect(notices[2].id).toBe("NOTICE-001");
  });

  it("skips files that fail to parse", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["NOTICE-001.md"]);
    mockReadFileSync.mockReturnValue(""); // will return null from parseNoticeFile

    expect(parseAllNotices()).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// findNoticeFile
// ──────────────────────────────────────────────────────────────
describe("findNoticeFile", () => {
  it("returns null when notices directory does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(findNoticeFile("NOTICE-001")).toBeNull();
  });

  it("returns full path when file found", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["NOTICE-001.md", "NOTICE-002.md"]);

    const result = findNoticeFile("NOTICE-001");
    expect(result).not.toBeNull();
    expect(result).toContain("NOTICE-001.md");
  });

  it("returns null when file not found", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["NOTICE-002.md"]);

    expect(findNoticeFile("NOTICE-001")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// getNoticesDir
// ──────────────────────────────────────────────────────────────
describe("getNoticesDir", () => {
  it("returns a non-empty string path", () => {
    const dir = getNoticesDir();
    expect(typeof dir).toBe("string");
    expect(dir.length).toBeGreaterThan(0);
  });
});
