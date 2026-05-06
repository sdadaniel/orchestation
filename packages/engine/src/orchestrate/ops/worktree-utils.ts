import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "../../lib/config/paths";

export function ensureBranchAndWorktree(
  branch: string,
  worktree: string,
  baseBranch: string,
  log?: (msg: string) => void,
): void {
  const worktreePath = path.resolve(PROJECT_ROOT, worktree);

  cleanupBranchAndWorktree(branch, worktree, log);

  try {
    execSync(
      `git -C "${PROJECT_ROOT}" rev-parse --verify "${baseBranch}"`,
      { stdio: "ignore" },
    );
  } catch {
    throw new Error(`Base branch not found: ${baseBranch}`);
  }

  execSync(`git -C "${PROJECT_ROOT}" branch -f "${branch}" "${baseBranch}"`, {
    stdio: "ignore",
  });
  execSync(
    `git -C "${PROJECT_ROOT}" worktree add "${worktreePath}" "${branch}"`,
    { stdio: "ignore" },
  );
  log?.(`📂 worktree 재생성: ${worktree} (branch: ${branch})`);
}

export function cleanupBranchAndWorktree(
  branch: string,
  worktree: string,
  log?: (msg: string) => void,
): void {
  const worktreePath = path.resolve(PROJECT_ROOT, worktree);

  if (fs.existsSync(worktreePath)) {
    try {
      execSync(
        `git -C "${PROJECT_ROOT}" worktree remove "${worktreePath}" --force`,
        { stdio: "ignore" },
      );
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    log?.(`🧹 기존 worktree 정리: ${worktree}`);
  }

  try {
    execSync(`git -C "${PROJECT_ROOT}" branch -D "${branch}"`, {
      stdio: "ignore",
    });
    log?.(`🧹 기존 branch 정리: ${branch}`);
  } catch {
    /* ignore */
  }
}
