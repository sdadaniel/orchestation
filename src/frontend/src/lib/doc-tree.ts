import fs from "fs";
import path from "path";
import { parsePrdFile } from "./prd-parser";

/* ── Types ── */

export interface DocNode {
  id: string;
  title: string;
  type: "doc" | "folder";
  file?: string; // only for docs
  children: DocNode[];
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
}

const PRD_DIR = path.join(process.cwd(), "../../docs/prd");
const MANIFEST_PATH = path.join(PRD_DIR, "_manifest.json");

/* ── Manifest I/O ── */

export function readManifest(): Manifest {
  if (!fs.existsSync(PRD_DIR)) {
    fs.mkdirSync(PRD_DIR, { recursive: true });
  }

  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
      return JSON.parse(raw) as Manifest;
    } catch {
      // corrupt manifest, regenerate
    }
  }

  // Auto-generate from existing .md files
  const manifest = generateManifestFromFiles();
  writeManifest(manifest);
  return manifest;
}

export function writeManifest(manifest: Manifest): void {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

function generateManifestFromFiles(): Manifest {
  if (!fs.existsSync(PRD_DIR)) return { tree: [] };

  const files = fs.readdirSync(PRD_DIR).filter((f) => f.endsWith(".md"));
  const tree: DocNode[] = [];

  for (const file of files) {
    const prd = parsePrdFile(path.join(PRD_DIR, file));
    if (prd) {
      tree.push({
        id: prd.id,
        title: prd.title || file.replace(".md", ""),
        type: "doc",
        file,
        children: [],
      });
    } else {
      // Non-frontmatter .md file
      const id = file.replace(".md", "");
      tree.push({
        id,
        title: id,
        type: "doc",
        file,
        children: [],
      });
    }
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

export function findParentPath(tree: DocNode[], targetId: string, path: string[] = []): string[] | null {
  for (const node of tree) {
    if (node.id === targetId) return path;
    const found = findParentPath(node.children, targetId, [...path, node.title]);
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

export function readDocContent(fileOrId: string): string {
  // Try direct file path first
  const filePath = path.join(PRD_DIR, fileOrId);
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf-8");
    // Strip frontmatter
    return raw.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
  }
  return "";
}

export function writeDocContent(fileName: string, content: string, title?: string): void {
  const filePath = path.join(PRD_DIR, fileName);

  if (fs.existsSync(filePath)) {
    // Preserve existing frontmatter
    const existing = fs.readFileSync(filePath, "utf-8");
    const fmMatch = existing.match(/^(---\n[\s\S]*?\n---)\n?/);
    if (fmMatch) {
      let frontmatter = fmMatch[1];
      // Update title in frontmatter if provided
      if (title !== undefined) {
        frontmatter = frontmatter.replace(/^title:\s*.+$/m, `title: ${title}`);
      }
      fs.writeFileSync(filePath, `${frontmatter}\n\n${content}`, "utf-8");
      return;
    }
  }

  // New file or no frontmatter
  const fm = `---\nid: ${path.basename(fileName, ".md")}\ntitle: ${title || "Untitled"}\nstatus: draft\n---`;
  fs.writeFileSync(filePath, `${fm}\n\n${content}`, "utf-8");
}

export function deleteDocFile(fileName: string): void {
  const filePath = path.join(PRD_DIR, fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/** Collect all doc files under a node (recursively) */
export function collectFiles(node: DocNode): string[] {
  const files: string[] = [];
  if (node.file) files.push(node.file);
  for (const child of node.children) {
    files.push(...collectFiles(child));
  }
  return files;
}

/** Generate a unique ID */
export function generateId(prefix: string = "doc"): string {
  return `${prefix}-${Date.now().toString(36)}`;
}
