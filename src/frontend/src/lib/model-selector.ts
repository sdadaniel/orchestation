/**
 * model-selector.ts — 태스크 복잡도 판단 + 모델 선택
 * scripts/lib/model-selector.sh의 Node.js 포팅
 */
import fs from "fs";
import { parseFrontmatter, getString, getStringArray } from "./frontmatter-utils";

const MODEL_SIMPLE = "claude-haiku-4-5";
const MODEL_COMPLEX = "claude-sonnet-4-6";

const COMPLEX_KEYWORDS = [
  "리팩토링", "refactor", "신규기능", "new feature", "architecture",
  "마이그레이션", "migration", "multi-file", "통합", "integration",
  "redesign", "implement", "engine", "pipeline", "system",
];

const SIMPLE_KEYWORDS = [
  "docs", "readme", "typo", "config", "comment", "version",
  "bump", "rename", "format", "lint", "cleanup", "문서", "오타", "설정", "주석",
];

export type Complexity = "simple" | "complex";

/**
 * 태스크 파일에서 복잡도를 판단한다.
 * 우선순위: frontmatter complexity 필드 > scope 수 > 키워드 휴리스틱
 */
export function determineComplexity(taskFilePath: string): Complexity {
  const raw = fs.readFileSync(taskFilePath, "utf-8");
  const { data } = parseFrontmatter(raw);

  // 1. frontmatter override
  const explicit = getString(data, "complexity");
  if (explicit === "simple" || explicit === "low") return "simple";
  if (explicit === "complex" || explicit === "high") return "complex";

  // 2. scope count
  const scope = getStringArray(data, "scope");
  const scopeCount = scope.length;
  const title = getString(data, "title").toLowerCase();

  // 3. keyword matching
  const complexHits = COMPLEX_KEYWORDS.filter(k => title.includes(k)).length;
  const simpleHits = SIMPLE_KEYWORDS.filter(k => title.includes(k)).length;

  // Decision rules
  if (scopeCount >= 4) return "complex";
  if (scopeCount <= 1 && complexHits <= 1 && simpleHits > 0) return "simple";
  if (complexHits >= 2) return "complex";
  if (complexHits >= 1 && scopeCount >= 3) return "complex";
  if (simpleHits > 0 && scopeCount <= 2) return "simple";
  if (scopeCount <= 2 && complexHits === 0) return "simple";

  return "complex";
}

/**
 * 태스크 파일에 적합한 모델을 선택한다.
 * MODEL_OVERRIDE 환경변수가 최우선.
 */
export function selectModel(taskFilePath: string): string {
  if (process.env.MODEL_OVERRIDE) return process.env.MODEL_OVERRIDE;

  const complexity = determineComplexity(taskFilePath);
  return complexity === "simple" ? MODEL_SIMPLE : MODEL_COMPLEX;
}

/**
 * 모델 선택 결과를 로깅한다.
 */
export function logModelSelection(
  taskFilePath: string,
  taskId: string,
  tokenLogPath: string
): { model: string; complexity: Complexity } {
  const complexity = determineComplexity(taskFilePath);
  const model = selectModel(taskFilePath);
  const logLine = `[${new Date().toISOString()}] ${taskId} | phase=model_selection | complexity=${complexity} | model=${model}\n`;

  try {
    fs.mkdirSync(require("path").dirname(tokenLogPath), { recursive: true });
    fs.appendFileSync(tokenLogPath, logLine);
  } catch { /* ignore */ }

  return { model, complexity };
}
