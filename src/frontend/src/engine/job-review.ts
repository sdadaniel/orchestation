/**
 * job-review.ts — 코드 리뷰 실행
 * scripts/job-review.sh의 Node.js 포팅
 */
import fs from "fs";
import path from "path";
import { PROJECT_ROOT, OUTPUT_DIR, ROLES_DIR } from "../lib/paths";
import { loadSettings } from "../lib/settings";
import { signalCreate } from "./signal";
import { setupContextFilter, buildReviewPrompt } from "./context-builder";
import { runClaudeStreamJson } from "./claude-worker";
import { getTask, taskRowToMarkdown } from "../service/task-store";
import { logTokenUsage } from "../service/token-logger";

const DEFAULT_REVIEW_MODEL = "claude-haiku-4-5";

export interface JobReviewResult {
  status: "review-approved" | "review-rejected";
  feedback?: string;
  cost?: number;
}

/**
 * 태스크 리뷰를 실행한다.
 * job-review.sh의 전체 플로우를 Node.js로 구현.
 */
export async function runJobReview(
  taskId: string,
  onLog?: (line: string) => void,
): Promise<JobReviewResult> {
  const log = (msg: string) => onLog?.(`[${taskId}/review] ${msg}`);
  let signalSent = false;

  try {
    // 1. DB에서 태스크 조회
    const task = getTask(taskId);
    if (!task) {
      log("❌ 태스크를 찾을 수 없음");
      signalCreate(taskId, "review-rejected");
      signalSent = true;
      return { status: "review-rejected" };
    }

    // buildReviewPrompt가 파일을 읽으므로 임시 파일 생성
    const tmpTaskFile = path.join(OUTPUT_DIR, `${taskId}-review-tmp.md`);
    fs.mkdirSync(path.dirname(tmpTaskFile), { recursive: true });
    fs.writeFileSync(tmpTaskFile, taskRowToMarkdown(task));
    const taskFile = tmpTaskFile;
    const taskFilename = `${task.id}-task.md`;

    const branch = task.branch;
    const worktree = task.worktree;
    const reviewerRole = task.reviewer_role || "reviewer-general";

    // 2. worktree 확인
    const worktreePath = worktree ? path.resolve(PROJECT_ROOT, worktree) : null;
    if (worktreePath && !fs.existsSync(worktreePath)) {
      log(`⚠️ worktree가 없음: ${worktreePath}`);
      signalCreate(taskId, "review-rejected");
      signalSent = true;
      return { status: "review-rejected" };
    }

    const workDir = worktreePath ?? PROJECT_ROOT;

    // 3. 리뷰어 role 프롬프트 로드
    const rolePrompt = loadReviewerRole(reviewerRole);
    log(`🔍 리뷰어: ${reviewerRole}`);

    // 4. context filter
    if (worktreePath) {
      setupContextFilter(worktreePath, PROJECT_ROOT);
    }

    // 5. 리뷰 프롬프트 빌드
    const settings = loadSettings();
    const prompt = buildReviewPrompt({
      taskFile,
      taskFilename,
      baseBranch: settings.baseBranch,
    });

    // 6. Claude 호출 (리뷰는 경량 모델 사용)
    const model = process.env.REVIEW_MODEL || DEFAULT_REVIEW_MODEL;
    log(`🤖 모델: ${model}`);

    const convFile = path.join(
      OUTPUT_DIR,
      `${taskId}-review-conversation.jsonl`,
    );
    fs.mkdirSync(path.dirname(convFile), { recursive: true });

    const claudeResult = await runClaudeStreamJson({
      prompt,
      systemPrompt: rolePrompt,
      model,
      cwd: workDir,
      convFile,
      timeout: 300000, // 5분
      onLine: (line) => log(line),
    });

    log(
      `✅ Claude 리뷰 완료 (exit=${claudeResult.exitCode}, cost=$${claudeResult.costUsd.toFixed(4)})`,
    );

    // 7. 결과 저장
    const resultFile = path.join(OUTPUT_DIR, `${taskId}-review.json`);
    fs.writeFileSync(
      resultFile,
      JSON.stringify(
        {
          taskId,
          result: claudeResult.result,
          cost_usd: claudeResult.costUsd,
          model,
          duration_ms: claudeResult.durationMs,
        },
        null,
        2,
      ),
    );

    // 8. 토큰 사용량 로깅
    logTokenUsage(taskId, "review", model, claudeResult);

    // 9. 승인/거절 판정
    const decision = parseDecision(claudeResult.result);
    log(`📋 판정: ${decision}`);

    cleanupTmpTaskFile(taskId);

    if (decision === "approved") {
      signalCreate(taskId, "review-approved");
      signalSent = true;
      return { status: "review-approved", cost: claudeResult.costUsd };
    } else {
      // 피드백 저장
      const feedbackFile = path.join(
        OUTPUT_DIR,
        `${taskId}-review-feedback.txt`,
      );
      fs.writeFileSync(feedbackFile, claudeResult.result);

      signalCreate(taskId, "review-rejected");
      signalSent = true;
      return {
        status: "review-rejected",
        feedback: claudeResult.result,
        cost: claudeResult.costUsd,
      };
    }
  } catch (err) {
    cleanupTmpTaskFile(taskId);
    const msg = err instanceof Error ? err.message : String(err);
    log(`❌ 오류: ${msg}`);
    if (!signalSent) {
      try {
        signalCreate(taskId, "review-rejected");
      } catch {
        /* ignore */
      }
    }
    return { status: "review-rejected" };
  }
}

// ── 헬퍼 함수들 ─────────────────────────────────────────

/** 임시 태스크 파일 정리 */
function cleanupTmpTaskFile(taskId: string): void {
  try {
    const tmpFile = path.join(OUTPUT_DIR, `${taskId}-review-tmp.md`);
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  } catch {
    /* ignore */
  }
}

function loadReviewerRole(role: string): string {
  const paths = [
    path.join(ROLES_DIR, `${role}.md`),
    path.join(ROLES_DIR, "reviewer-general.md"),
    path.join(ROLES_DIR, "general.md"),
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  }

  return "당신은 코드 리뷰어입니다. Task 완료 조건을 기준으로 변경 사항을 검증하세요.";
}

/**
 * Claude 리뷰 결과에서 승인/거절을 판정한다.
 * job-review.sh의 파싱 로직 포팅.
 */
function parseDecision(result: string): "approved" | "rejected" {
  // 새 형식: **Decision**: APPROVE
  if (/\*\*Decision\*\*:\s*APPROVE/i.test(result)) return "approved";

  // 레거시 한국어: "승인" 포함 + "수정요청" 미포함
  if (result.includes("승인") && !result.includes("수정요청"))
    return "approved";

  // REJECT 명시
  if (/\*\*Decision\*\*:\s*REJECT/i.test(result)) return "rejected";

  return "rejected";
}
