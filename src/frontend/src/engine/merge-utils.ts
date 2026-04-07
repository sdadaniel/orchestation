/**
 * merge-utils.ts — 머지 + 충돌 해결 + 클린업
 * scripts/lib/merge-task.sh + merge-resolver.sh의 Node.js 포팅
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "../lib/paths";
import { writeNotice } from "../parser/notice-parser";
import { loadSettings } from "../lib/settings";
import { runClaudeJson } from "./claude-worker";
import { getTask, updateTaskStatus } from "../service/task-store";

/**
 * 태스크 브랜치를 메인에 머지하고 클린업한다.
 * merge-task.sh의 전체 플로우.
 */
export async function runMergeTask(
  taskId: string,
  onLog?: (line: string) => void,
): Promise<boolean> {
  const log = (msg: string) => onLog?.(`[${taskId}/merge] ${msg}`);

  try {
    const task = getTask(taskId);
    if (!task) {
      log("❌ 태스크를 찾을 수 없음");
      return false;
    }

    const branch = task.branch;
    const worktree = task.worktree;
    const settings = loadSettings();
    const baseBranch = settings.baseBranch;

    if (!branch) {
      log("ℹ️ 브랜치 없음 — 머지 스킵, 상태만 업데이트");
      updateTaskStatus(taskId, "done", task.status);
      return true;
    }

    // 브랜치에 커밋이 있는지 확인
    let hasCommits = false;
    try {
      const commits = execSync(
        `git -C "${PROJECT_ROOT}" log --oneline "${baseBranch}..${branch}" 2>/dev/null`,
        { encoding: "utf-8" },
      ).trim();
      hasCommits = !!commits;
    } catch { /* 브랜치가 없거나 커밋 없음 */ }

    if (hasCommits) {
      log(`🔀 ${branch} → ${baseBranch} 머지`);

      // stash 보호
      let stashed = false;
      try {
        const dirty = execSync(`git -C "${PROJECT_ROOT}" status --porcelain`, { encoding: "utf-8" }).trim();
        if (dirty) {
          execSync(`git -C "${PROJECT_ROOT}" stash push -m "merge-${taskId}" --include-untracked`, { stdio: "ignore" });
          stashed = true;
        }
      } catch { /* ignore */ }

      // 머지 시도
      let mergeFailed = false;
      try {
        execSync(`git -C "${PROJECT_ROOT}" merge "${branch}" --no-ff --no-edit`, { stdio: "ignore" });
        log("✅ 머지 성공");
      } catch {
        log("⚠️ 머지 충돌 → 자동 해결 시도");
        const resolved = await resolveMergeConflict(taskId, branch, baseBranch, log);
        if (!resolved) {
          mergeFailed = true;
          try { execSync(`git -C "${PROJECT_ROOT}" merge --abort`, { stdio: "ignore" }); } catch { /* ignore */ }
        }
      }

      // stash 복원
      if (stashed) {
        try { execSync(`git -C "${PROJECT_ROOT}" stash pop`, { stdio: "ignore" }); } catch { /* ignore */ }
      }

      if (mergeFailed) {
        log("❌ 머지 실패");
        postNotice("error", `${taskId} 머지 실패`, `충돌 자동 해결에 실패했습니다.`);
        return false;
      }
    }

    // 브랜치 삭제
    try { execSync(`git -C "${PROJECT_ROOT}" branch -d "${branch}"`, { stdio: "ignore" }); } catch { /* ignore */ }

    // worktree 삭제
    const worktreePath = worktree ? path.resolve(PROJECT_ROOT, worktree) : null;
    if (worktreePath && fs.existsSync(worktreePath)) {
      try { execSync(`git -C "${PROJECT_ROOT}" worktree remove "${worktreePath}" --force`, { stdio: "ignore" }); } catch { /* ignore */ }
    }

    // 상태 업데이트
    updateTaskStatus(taskId, "done", task.status);
    log("✅ 머지 완료, 상태 → done");

    return true;
  } catch (err) {
    log(`❌ 오류: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ── 충돌 자동 해결 ─────────────────────────────────────

async function resolveMergeConflict(
  taskId: string,
  branch: string,
  baseBranch: string,
  log: (msg: string) => void,
): Promise<boolean> {
  try {
    // 충돌 파일 목록
    const conflictFiles = execSync(
      `git -C "${PROJECT_ROOT}" diff --name-only --diff-filter=U`,
      { encoding: "utf-8" },
    ).trim();

    if (!conflictFiles) {
      log("충돌 파일 없음");
      return true;
    }

    log(`충돌 파일: ${conflictFiles}`);

    // 충돌 내용 수집
    const conflictDetails: string[] = [];
    for (const file of conflictFiles.split("\n")) {
      if (!file.trim()) continue;
      try {
        const content = fs.readFileSync(path.join(PROJECT_ROOT, file), "utf-8");
        conflictDetails.push(`### ${file}\n\`\`\`\n${content}\n\`\`\``);
      } catch { /* ignore */ }
    }

    // Claude로 충돌 해결
    const prompt = `다음 git merge 충돌을 해결해주세요. 각 파일에서 충돌 마커(<<<<<<, ======, >>>>>>)를 제거하고 올바른 코드만 남겨주세요.

브랜치: ${branch} → ${baseBranch}

${conflictDetails.join("\n\n")}

각 파일의 해결된 내용을 출력해주세요.`;

    const result = await runClaudeJson({
      prompt,
      cwd: PROJECT_ROOT,
      timeout: 300000, // 5분
    });

    // 남은 충돌 마커 확인
    let hasRemainingConflicts = false;
    for (const file of conflictFiles.split("\n")) {
      if (!file.trim()) continue;
      try {
        const content = fs.readFileSync(path.join(PROJECT_ROOT, file), "utf-8");
        if (content.includes("<<<<<<<") || content.includes(">>>>>>>")) {
          hasRemainingConflicts = true;
          break;
        }
      } catch { /* ignore */ }
    }

    if (hasRemainingConflicts) {
      log("❌ 충돌 마커가 남아있음");
      postNotice("error", `${taskId} 충돌 해결 실패`, "자동 충돌 해결에 실패했습니다. 수동 해결이 필요합니다.");
      return false;
    }

    // 충돌 해결된 파일들을 stage
    execSync(`git -C "${PROJECT_ROOT}" add ${conflictFiles.split("\n").map(f => `"${f}"`).join(" ")}`, { stdio: "ignore" });
    execSync(`git -C "${PROJECT_ROOT}" commit --no-edit`, { stdio: "ignore" });

    log("✅ 충돌 자동 해결 완료");
    postNotice("warning", `${taskId} 충돌 자동 해결`, "머지 충돌이 자동으로 해결되었습니다. 검토해주세요.");
    return true;
  } catch (err) {
    log(`❌ 충돌 해결 실패: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ── 유틸리티 ───────────────────────────────────────────

function postNotice(type: string, title: string, content: string): void {
  writeNotice(type as "info" | "warning" | "error" | "request", title, content);
}
