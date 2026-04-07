/**
 * job-task.ts — 단일 태스크 실행
 * scripts/job-task.sh의 Node.js 포팅
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT, OUTPUT_DIR, ROLES_DIR } from "../lib/paths";
import { loadSettings } from "../lib/settings";
import { signalCreate } from "./signal";
import { logModelSelection } from "./model-selector";
import { setupContextFilter, buildTaskPrompt } from "./context-builder";
import { runClaudeStreamJson } from "./claude-worker";
import { getTask, parseScope, parseContext, taskRowToMarkdown } from "../service/task-store";
import { logTokenUsage } from "../service/token-logger";

export interface JobTaskResult {
  status: "task-done" | "task-failed" | "task-rejected";
  cost?: number;
  model?: string;
  result?: string;
}

/**
 * 단일 태스크를 실행한다.
 * job-task.sh의 전체 플로우를 Node.js로 구현.
 */
export async function runJobTask(
  taskId: string,
  feedbackFile?: string,
  onLog?: (line: string) => void,
): Promise<JobTaskResult> {
  const log = (msg: string) => onLog?.(`[${taskId}] ${msg}`);
  let signalSent = false;

  try {
    // 1. DB에서 태스크 조회
    const task = getTask(taskId);
    if (!task) {
      log("❌ 태스크를 찾을 수 없음");
      signalCreate(taskId, "task-failed");
      signalSent = true;
      return { status: "task-failed" };
    }

    // buildTaskPrompt / logModelSelection 등 파일 경로가 필요한 함수를 위해 임시 파일 생성
    const tmpTaskFile = path.join(OUTPUT_DIR, `${taskId}-task-tmp.md`);
    fs.mkdirSync(path.dirname(tmpTaskFile), { recursive: true });
    fs.writeFileSync(tmpTaskFile, taskRowToMarkdown(task));
    const taskFile = tmpTaskFile;
    const taskFilename = `${task.id}-task.md`;

    const branch = task.branch;
    const worktree = task.worktree;
    const role = task.role || "general";
    const scope = parseScope(task);
    const context = parseContext(task);

    log(`📋 태스크: ${task.title}`);
    log(`📂 scope: ${scope.join(", ") || "(없음)"}`);

    // 2. worktree 확인/생성
    const worktreePath = worktree ? path.resolve(PROJECT_ROOT, worktree) : null;
    if (worktreePath && branch) {
      ensureWorktree(worktreePath, branch, log);
    }

    const workDir = worktreePath ?? PROJECT_ROOT;

    // 3. role 프롬프트 로드
    const rolePrompt = loadRolePrompt(role);
    log(`🎭 역할: ${role}`);

    // 4. context filter 설정 + .claudeignore를 .gitignore에 추가
    if (worktreePath) {
      // .claudeignore가 git에 추적되지 않도록 .gitignore에 추가
      ensureGitignoreEntry(worktreePath, ".claudeignore");
      setupContextFilter(worktreePath, PROJECT_ROOT);
    }

    // 5. 프롬프트 빌드
    const prompt = buildTaskPrompt({
      taskFile,
      taskFilename,
      scope,
      context,
      feedbackFile,
      worktreePath: worktreePath ?? "",
    });

    // 6. 모델 선택
    const tokenLogPath = path.join(OUTPUT_DIR, "token-usage.log");
    const { model, complexity } = logModelSelection(taskFile, taskId, tokenLogPath);
    log(`🤖 모델: ${model} (복잡도: ${complexity})`);

    // 7. Claude 호출
    const convFile = path.join(OUTPUT_DIR, `${taskId}-task-conversation.jsonl`);
    fs.mkdirSync(path.dirname(convFile), { recursive: true });

    const claudeResult = await runClaudeStreamJson({
      prompt,
      systemPrompt: rolePrompt,
      model,
      cwd: workDir,
      convFile,
      timeout: 600000, // 10분
      onLine: (line) => log(line),
    });

    log(`✅ Claude 완료 (exit=${claudeResult.exitCode}, cost=$${claudeResult.costUsd.toFixed(4)})`);

    // 8. 결과 저장
    const resultFile = path.join(OUTPUT_DIR, `${taskId}-task.json`);
    fs.writeFileSync(resultFile, JSON.stringify({
      taskId,
      status: claudeResult.exitCode === 0 ? "done" : "failed",
      result: claudeResult.result,
      cost_usd: claudeResult.costUsd,
      input_tokens: claudeResult.inputTokens,
      output_tokens: claudeResult.outputTokens,
      model,
      duration_ms: claudeResult.durationMs,
    }, null, 2));

    // 9. 토큰 사용량 로깅
    logTokenUsage(taskId, "task", model, claudeResult);

    // 10. .claudeignore 정리 (워크트리에 생성된 파일)
    if (worktreePath) {
      const ignoreFile = path.join(worktreePath, ".claudeignore");
      try {
        if (fs.existsSync(ignoreFile)) fs.unlinkSync(ignoreFile);
      } catch { /* ignore */ }
    }

    // 11. 거절 확인
    if (claudeResult.result.startsWith("거절:")) {
      const reason = claudeResult.result.split("\n")[0].replace("거절:", "").trim();
      log(`🚫 거절: ${reason}`);
      const reasonFile = path.join(OUTPUT_DIR, `${taskId}-rejection-reason.txt`);
      fs.writeFileSync(reasonFile, claudeResult.result);
      signalCreate(taskId, "task-rejected");
      signalSent = true;
      return { status: "task-rejected", cost: claudeResult.costUsd, model, result: claudeResult.result };
    }

    // 11. 실행 실패 확인
    if (claudeResult.exitCode !== 0) {
      log(`❌ Claude 비정상 종료 (exit=${claudeResult.exitCode})`);
      signalCreate(taskId, "task-failed");
      signalSent = true;
      return { status: "task-failed", cost: claudeResult.costUsd, model };
    }

    // 12. 스코프 검증 (워크트리에서, base branch 대비)
    if (worktreePath && scope.length > 0) {
      const settings = loadSettings();
      validateScope(worktreePath, scope, taskId, settings.baseBranch, log);
    }

    // 13. 성공 시그널
    signalCreate(taskId, "task-done");
    signalSent = true;
    log(`✅ task-done 시그널 생성`);

    cleanupTmpTaskFile(taskId);
    return { status: "task-done", cost: claudeResult.costUsd, model, result: claudeResult.result };
  } catch (err) {
    cleanupTmpTaskFile(taskId);
    const msg = err instanceof Error ? err.message : String(err);
    log(`❌ 오류: ${msg}`);
    if (!signalSent) {
      try { signalCreate(taskId, "task-failed"); } catch { /* ignore */ }
    }
    return { status: "task-failed" };
  }
}

// ── 헬퍼 함수들 ─────────────────────────────────────────

function ensureGitignoreEntry(worktreePath: string, entry: string): void {
  try {
    const gitignorePath = path.join(worktreePath, ".gitignore");
    let content = "";
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, "utf-8");
    }
    if (!content.split("\n").includes(entry)) {
      fs.appendFileSync(gitignorePath, `\n${entry}\n`);
    }
  } catch { /* ignore */ }
}

/** 임시 태스크 파일 정리 */
function cleanupTmpTaskFile(taskId: string): void {
  try {
    const tmpFile = path.join(OUTPUT_DIR, `${taskId}-task-tmp.md`);
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  } catch { /* ignore */ }
}

function ensureWorktree(worktreePath: string, branch: string, log: (msg: string) => void): void {
  if (fs.existsSync(worktreePath)) {
    log(`📂 worktree 존재: ${worktreePath}`);
    return;
  }

  log(`📂 worktree 생성: ${worktreePath} (branch: ${branch})`);
  try {
    // 브랜치가 없으면 생성
    try {
      execSync(`git -C "${PROJECT_ROOT}" rev-parse --verify "${branch}" 2>/dev/null`, { stdio: "ignore" });
    } catch {
      execSync(`git -C "${PROJECT_ROOT}" branch "${branch}"`, { stdio: "ignore" });
    }
    execSync(`git -C "${PROJECT_ROOT}" worktree add "${worktreePath}" "${branch}"`, { stdio: "ignore" });
  } catch (err) {
    log(`⚠️ worktree 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function loadRolePrompt(role: string): string {
  const rolePaths = [
    path.join(ROLES_DIR, `${role}.md`),
    path.join(ROLES_DIR, "general.md"),
  ];

  for (const p of rolePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  }

  return "당신은 숙련된 소프트웨어 엔지니어입니다. 주어진 태스크를 정확하고 효율적으로 수행하세요.";
}

function validateScope(
  worktreePath: string,
  scope: string[],
  taskId: string,
  baseBranch: string,
  log: (msg: string) => void,
): void {
  try {
    // base branch 대비 모든 변경 파일 확인 (커밋된 것 포함)
    const diff = execSync(
      `git -C "${worktreePath}" diff --name-only ${baseBranch}..HEAD 2>/dev/null`,
      { encoding: "utf-8" },
    ).trim();

    // 아직 커밋되지 않은 변경도 확인
    const unstaged = execSync(
      `git -C "${worktreePath}" diff --name-only HEAD 2>/dev/null`,
      { encoding: "utf-8" },
    ).trim();

    const allChanges = [...new Set([...diff.split("\n"), ...unstaged.split("\n")])].filter(Boolean);
    if (allChanges.length === 0) return;

    // 빌드 아티팩트 및 context filter 파일은 scope 검증에서 제외
    const IGNORED_FILES = [".claudeignore", ".gitignore"];
    const changedFiles = allChanges.filter(f => !IGNORED_FILES.includes(f));
    const outOfScope: string[] = [];

    for (const f of changedFiles) {
      const inScope = scope.some(s => {
        const base = s.replace(/\/\*\*$/, "");
        return f === s || f.startsWith(base);
      });
      if (!inScope) outOfScope.push(f);
    }

    if (outOfScope.length > 0) {
      log(`⚠️ 스코프 외 변경 감지: ${outOfScope.join(", ")}`);
      for (const f of outOfScope) {
        try {
          execSync(`git -C "${worktreePath}" checkout -- "${f}"`, { stdio: "ignore" });
        } catch { /* ignore */ }
      }
      log(`🔄 스코프 외 변경 복원 완료`);
    }
  } catch { /* ignore */ }
}

