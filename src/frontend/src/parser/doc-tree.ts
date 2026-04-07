import fs from "fs";
import path from "path";
import matter from "gray-matter";

/* ── Types ── */

export interface DocNode {
  id: string;
  title: string;
  type: "doc" | "folder";
  file?: string; // relative path from DOCS_DIR (e.g. "prd/doc-xxx.md")
  children: DocNode[];
  readonly?: boolean; // true for auto-scanned dirs (not prd)
}

export interface Manifest {
  tree: DocNode[];
}

export interface DocDetail {
  id: string;
  title: string;
  type: "doc" | "folder";
  file?: string;
  content: string;
  parentPath: string[]; // breadcrumb titles
  readonly?: boolean;
}

const DOCS_DIR = path.join(process.cwd(), "../../docs");
const PRD_DIR = path.join(DOCS_DIR, "prd");
const MANIFEST_PATH = path.join(PRD_DIR, "_manifest.json");

/* ── Full docs tree (filesystem scan + prd manifest merge) ── */

const IGNORED = new Set(["_manifest.json", ".DS_Store", "README.md"]);
// docs tree에서 제외할 디렉토리 (전용 탭이 있는 것들)
const EXCLUDED_DIRS = new Set(["task", "requests"]);

function titleFromFile(filePath: string): string {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(raw);
    if (data.title) return data.title;
    if (data.id) return data.id;
  } catch { /* ignore */ }
  return path.basename(filePath, ".md");
}

function scanDirectory(dirPath: string, relDir: string, isReadonly: boolean): DocNode[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((e) => !IGNORED.has(e.name) && !e.name.startsWith("."))
    .sort((a, b) => {
      // folders first, then files
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const nodes: DocNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = scanDirectory(fullPath, relPath, isReadonly);
      nodes.push({
        id: `dir-${relPath.replace(/\//g, "-")}`,
        title: entry.name,
        type: "folder",
        children,
        readonly: isReadonly,
      });
    } else if (entry.name.endsWith(".md")) {
      const title = titleFromFile(fullPath);
      nodes.push({
        id: `file-${relPath.replace(/\//g, "-").replace(".md", "")}`,
        title,
        type: "doc",
        file: relPath,
        children: [],
        readonly: isReadonly,
      });
    }
  }

  return nodes;
}

/** Build full docs tree: prd uses manifest, others are filesystem-scanned */
export function readFullTree(): Manifest {
  const tree: DocNode[] = [];

  if (!fs.existsSync(DOCS_DIR)) return { tree };

  const topEntries = fs.readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter((e) => !IGNORED.has(e.name) && !e.name.startsWith("."))
    .filter((e) => !e.isDirectory() || !EXCLUDED_DIRS.has(e.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  for (const entry of topEntries) {
    const fullPath = path.join(DOCS_DIR, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "prd") {
        // PRD uses manifest-based management
        const prdManifest = readPrdManifest();
        tree.push({
          id: "dir-prd",
          title: "prd",
          type: "folder",
          children: prdManifest.tree,
          readonly: false,
        });
      } else {
        // Other dirs: filesystem scan, read-only
        const children = scanDirectory(fullPath, entry.name, true);
        tree.push({
          id: `dir-${entry.name}`,
          title: entry.name,
          type: "folder",
          children,
          readonly: true,
        });
      }
    } else if (entry.name.endsWith(".md")) {
      const title = titleFromFile(fullPath);
      tree.push({
        id: `file-${entry.name.replace(".md", "")}`,
        title,
        type: "doc",
        file: entry.name,
        children: [],
        readonly: true,
      });
    }
  }

  return { tree };
}

/* ── PRD Manifest I/O (for CRUD operations) ── */

export function readPrdManifest(): Manifest {
  if (!fs.existsSync(PRD_DIR)) {
    fs.mkdirSync(PRD_DIR, { recursive: true });
  }

  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
      return JSON.parse(raw) as Manifest;
    } catch { /* corrupt manifest, regenerate */ }
  }

  const manifest = generateManifestFromFiles();
  writeManifest(manifest);
  return manifest;
}

/** Legacy alias — used by API routes for CRUD */
export function readManifest(): Manifest {
  return readPrdManifest();
}

export function writeManifest(manifest: Manifest): void {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

function generateManifestFromFiles(): Manifest {
  if (!fs.existsSync(PRD_DIR)) return { tree: [] };

  const files = fs.readdirSync(PRD_DIR).filter((f) => f.endsWith(".md"));
  const tree: DocNode[] = [];

  for (const file of files) {
    const title = titleFromFile(path.join(PRD_DIR, file));
    const id = file.replace(".md", "");
    tree.push({ id, title, type: "doc", file, children: [] });
  }

  return { tree };
}

/* ── Tree helpers ── */

export function findNodeById(tree: DocNode[], id: string): DocNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

export function findParentPath(tree: DocNode[], targetId: string, breadcrumb: string[] = []): string[] | null {
  for (const node of tree) {
    if (node.id === targetId) return breadcrumb;
    const found = findParentPath(node.children, targetId, [...breadcrumb, node.title]);
    if (found) return found;
  }
  return null;
}

export function removeNodeById(tree: DocNode[], id: string): boolean {
  for (let i = 0; i < tree.length; i++) {
    if (tree[i].id === id) {
      tree.splice(i, 1);
      return true;
    }
    if (removeNodeById(tree[i].children, id)) return true;
  }
  return false;
}

export function insertNode(tree: DocNode[], parentId: string | null, node: DocNode, index?: number): boolean {
  if (!parentId) {
    if (index !== undefined) {
      tree.splice(index, 0, node);
    } else {
      tree.push(node);
    }
    return true;
  }
  const parent = findNodeById(tree, parentId);
  if (parent && parent.type === "folder") {
    if (index !== undefined) {
      parent.children.splice(index, 0, node);
    } else {
      parent.children.push(node);
    }
    return true;
  }
  return false;
}

/* ── Doc content I/O ── */

/** Read doc content — file path is relative to DOCS_DIR */
export function readDocContent(fileRelPath: string): string {
  // Try as relative to DOCS_DIR first
  let filePath = path.join(DOCS_DIR, fileRelPath);
  if (!fs.existsSync(filePath)) {
    // Fallback: try as relative to PRD_DIR (legacy)
    filePath = path.join(PRD_DIR, fileRelPath);
  }
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf-8");
    return raw.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
  }
  return "";
}

/** Write doc content */
export function writeDocContent(fileName: string, content: string, title?: string): void {
  // DOCS_DIR 기준으로 먼저 시도, 없으면 PRD_DIR 폴백
  let filePath = path.join(DOCS_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PRD_DIR, fileName);
  }

  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8");
    const fmMatch = existing.match(/^(---\n[\s\S]*?\n---)\n?/);
    if (fmMatch) {
      let frontmatter = fmMatch[1];
      if (title !== undefined) {
        frontmatter = frontmatter.replace(/^title:\s*.+$/m, `title: ${title}`);
      }
      fs.writeFileSync(filePath, `${frontmatter}\n\n${content}`, "utf-8");
      return;
    }
  }

  const fm = `---\nid: ${path.basename(fileName, ".md")}\ntitle: ${title || "Untitled"}\nstatus: draft\n---`;
  fs.writeFileSync(filePath, `${fm}\n\n${content}`, "utf-8");
}

export function deleteDocFile(fileName: string): void {
  // DOCS_DIR 기준으로 먼저 시도, 없으면 PRD_DIR 폴백
  let filePath = path.join(DOCS_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PRD_DIR, fileName);
  }
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function collectFiles(node: DocNode): string[] {
  const files: string[] = [];
  if (node.file) files.push(node.file);
  for (const child of node.children) {
    files.push(...collectFiles(child));
  }
  return files;
}

export function generateId(prefix: string = "doc"): string {
  return `${prefix}-${Date.now().toString(36)}`;
}
