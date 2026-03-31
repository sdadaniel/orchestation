import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "./paths";

// 패키지 내부 template/ 우선, 프로젝트 루트 fallback
const PACKAGE_DIR = process.env.PACKAGE_DIR || path.resolve(__dirname, "..", "..", "..", "..");
const _pkgTemplate = path.join(PACKAGE_DIR, "template");
const _projTemplate = path.join(PROJECT_ROOT, "template");
const TEMPLATE_DIR = fs.existsSync(_pkgTemplate) ? _pkgTemplate : _projTemplate;

/**
 * template 파일을 읽고 {{variable}} 형식의 placeholder를 치환한다.
 *
 * @param templatePath - template/ 기준 상대 경로 (예: "entity/task.md", "prompt/task-analyze.md")
 * @param vars - 치환할 변수 맵 (예: { task_id: "TASK-001", title: "Fix bug" })
 */
export function renderTemplate(
  templatePath: string,
  vars: Record<string, string>,
): string {
  const filePath = path.join(TEMPLATE_DIR, templatePath);
  let content = fs.readFileSync(filePath, "utf-8");

  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }

  return content;
}

/**
 * template 파일을 읽기만 한다 (변수 치환 없이).
 * 프롬프트처럼 동적 치환이 코드에서 직접 필요한 경우.
 */
export function readTemplate(templatePath: string): string {
  const filePath = path.join(TEMPLATE_DIR, templatePath);
  return fs.readFileSync(filePath, "utf-8");
}
