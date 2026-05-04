import fs from "fs";
import os from "os";
import path from "path";
import type { TaskPriority } from "@/entities/task";
import {
  spawnClaude,
  CLAUDE_DEFAULT_MODEL,
  CLAUDE_DEFAULT_TIMEOUT_MS,
  ClaudeChildProcess,
} from "@/lib/ai/claude-cli";
import { parseClaudePrintJsonEnvelope } from "@/lib/ai/claude-cli-result";
import { renderTemplate } from "@/lib/template";
import { ROLES_DIR } from "@/lib/config/paths";
import { jsonErrorResponse } from "@/lib/errors/error-utils";
import { appendDashboardAiConversationLog } from "@/service/dashboard-ai-conversation-log";
import {
  logDashboardAiUsage,
  type DashboardAiPhase,
} from "@/service/token-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AnalyzedTask {
  title: string;
  description: string;
  priority: TaskPriority;
  criteria: string[];
  scope: string[];
  context: string[];
  depends_on: number[];
  role: string;
}

/** docs/roles/ 폴더에서 role 목록을 동적으로 읽기 (reviewer-* 제외) */
function getAvailableRoles(): string[] {
  try {
    const rolesDir = ROLES_DIR;
    return fs
      .readdirSync(rolesDir)
      .filter(
        (f) =>
          f.endsWith(".md") && !f.startsWith("reviewer-") && f !== "README.md",
      )
      .map((f) => f.replace(".md", ""));
  } catch {
    return ["general"];
  }
}

function accumulateStreamText(
  stream: NodeJS.ReadableStream,
  append: (chunk: string) => void,
): void {
  stream.on("data", (chunk: Buffer) => {
    append(chunk.toString());
  });
}

const DEBUG_DUMP_MAX_BYTES = 2_000_000;

function shouldDumpAnalyzeStreamsToDisk(): boolean {
  if (process.env.TASK_ANALYZE_DEBUG_DUMP === "1") return true;
  if (process.env.TASK_ANALYZE_DEBUG_DUMP === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function dumpAnalyzeStreamsToDisk(opts: {
  title: string;
  code: number | null;
  stdout: string;
  stderr: string;
}): { stdoutPath: string; stderrPath: string } | null {
  if (!shouldDumpAnalyzeStreamsToDisk()) return null;

  const safeTitle = opts.title
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `orchestation-task-analyze__${stamp}__exit-${opts.code ?? "null"}__${safeTitle || "untitled"}`;

  const stdoutPath = path.join(os.tmpdir(), `${base}.stdout.txt`);
  const stderrPath = path.join(os.tmpdir(), `${base}.stderr.txt`);

  const truncate = (s: string) => {
    const buf = Buffer.from(s, "utf-8");
    if (buf.length <= DEBUG_DUMP_MAX_BYTES) return s;
    return (
      buf.subarray(0, DEBUG_DUMP_MAX_BYTES).toString("utf-8") +
      `\n\n[truncated: original utf-8 bytes=${buf.length}, max=${DEBUG_DUMP_MAX_BYTES}]\n`
    );
  };

  try {
    fs.writeFileSync(stdoutPath, truncate(opts.stdout), "utf-8");
    fs.writeFileSync(stderrPath, truncate(opts.stderr), "utf-8");
    // Route handlers run on the server — this goes to the server terminal, not the browser console.
    console.info(`[api/tasks/analyze] dumped streams:\n- ${stdoutPath}\n- ${stderrPath}`);
    return { stdoutPath, stderrPath };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonErrorResponse("Invalid JSON body");
  }

  const title = typeof body.title === "string" ? body.title : "";
  const description =
    typeof body.description === "string" ? body.description : "";
  const revisionNotes =
    typeof body.revision_notes === "string"
      ? body.revision_notes.trim()
      : "";
  const rawCurrent = body.current_tasks;

  if (!title.trim()) {
    return jsonErrorResponse("title is required");
  }

  const roles = getAvailableRoles();
  const rolesDescription = roles.map((r) => `  - ${r}`).join("\n");

  const isRefine =
    revisionNotes.length > 0 &&
    Array.isArray(rawCurrent) &&
    rawCurrent.length > 0;

  const usagePhase: DashboardAiPhase = isRefine
    ? "analyze_refine"
    : "analyze";

  let prompt: string;
  if (isRefine) {
    const cleanedForPrompt = rawCurrent.map((t: unknown) => {
      const o =
        t && typeof t === "object" ? (t as Record<string, unknown>) : {};
      return {
        title: typeof o.title === "string" ? o.title : "",
        description: typeof o.description === "string" ? o.description : "",
        priority: o.priority,
        criteria: o.criteria,
        scope: o.scope,
        context: o.context,
        depends_on: o.depends_on,
        role: o.role,
      };
    });
    prompt = renderTemplate("prompt/task-analyze-refine.md", {
      title: title.trim(),
      description_line: description.trim()
        ? `Description: ${description.trim()}`
        : "",
      revision_notes: revisionNotes,
      current_tasks_json: JSON.stringify(cleanedForPrompt, null, 2),
      available_roles: rolesDescription,
    });
  } else {
    prompt = renderTemplate("prompt/task-analyze.md", {
      title: title.trim(),
      description_line: description.trim()
        ? `Description: ${description.trim()}`
        : "",
      available_roles: rolesDescription,
    });
  }

  return new Promise<Response>((resolve) => {
    const startedAt = Date.now();
    let settled = false;
    let clientAborted = false;
    let timedOut = false;

    const child: ClaudeChildProcess = spawnClaude(prompt, {
      outputFormat: "json",
      extraArgs: ["--dangerously-skip-permissions"],
    });

    let stdout = "";
    let stderr = "";

    accumulateStreamText(child.stdout, (t) => {
      stdout += t;
    });
    accumulateStreamText(child.stderr, (t) => {
      stderr += t;
    });

    const onClientAbort = () => {
      if (settled) return;
      clientAborted = true;
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    };
    request.signal.addEventListener("abort", onClientAbort);
    if (request.signal.aborted) {
      onClientAbort();
    }

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      appendDashboardAiConversationLog({
        phase: usagePhase,
        model: CLAUDE_DEFAULT_MODEL,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        timedOut: true,
        prompt,
        stdout,
        stderr,
      });
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      settle(
        jsonErrorResponse({
          error: "Analysis timed out. Please try again.",
          status: 504,
          code: "TIMEOUT",
        }),
      );
    }, CLAUDE_DEFAULT_TIMEOUT_MS);

    function settle(response: Response) {
      if (settled) return;
      settled = true;
      request.signal.removeEventListener("abort", onClientAbort);
      clearTimeout(timeoutTimer);
      resolve(response);
    }

    child.on("close", (code) => {
      dumpAnalyzeStreamsToDisk({
        title,
        code,
        stdout,
        stderr,
      });
      clearTimeout(timeoutTimer);
      if (settled) return;

      let printEnvelope: ReturnType<typeof parseClaudePrintJsonEnvelope> | null =
        null;
      try {
        printEnvelope = parseClaudePrintJsonEnvelope(stdout);
      } catch {
        /* envelope 파싱 실패 시에도 원문 stdout은 jsonl에 남김 */
      }

      const usageFromEnvelope = printEnvelope
        ? {
            costUsd: printEnvelope.usage.costUsd,
            inputTokens: printEnvelope.usage.inputTokens,
            outputTokens: printEnvelope.usage.outputTokens,
            durationMs: Date.now() - startedAt,
            cacheCreate: printEnvelope.usage.cacheCreate,
            cacheRead: printEnvelope.usage.cacheRead,
            turns: printEnvelope.usage.turns,
          }
        : undefined;

      if (clientAborted) {
        appendDashboardAiConversationLog({
          phase: usagePhase,
          model: CLAUDE_DEFAULT_MODEL,
          exitCode: code,
          durationMs: Date.now() - startedAt,
          clientAborted: true,
          prompt,
          stdout,
          stderr,
          usage: usageFromEnvelope,
        });
        settle(
          jsonErrorResponse({
            error: "요청이 취소되었습니다.",
            status: 499,
            code: "ABORTED",
          }),
        );
        return;
      }

      appendDashboardAiConversationLog({
        phase: usagePhase,
        model: CLAUDE_DEFAULT_MODEL,
        exitCode: code,
        durationMs: Date.now() - startedAt,
        prompt,
        stdout,
        stderr,
        usage: usageFromEnvelope,
      });

      if (code !== 0) {
        settle(
          jsonErrorResponse({
            error: "AI analysis failed. Please try again.",
            status: 500,
          }),
        );
        return;
      }

      if (printEnvelope) {
        logDashboardAiUsage(usagePhase, CLAUDE_DEFAULT_MODEL, {
          costUsd: printEnvelope.usage.costUsd,
          inputTokens: printEnvelope.usage.inputTokens,
          outputTokens: printEnvelope.usage.outputTokens,
          durationMs: Date.now() - startedAt,
          cacheCreate: printEnvelope.usage.cacheCreate,
          cacheRead: printEnvelope.usage.cacheRead,
          turns: printEnvelope.usage.turns,
        });
      }

      try {
        const resultText = printEnvelope?.resultText ?? stdout;
        const jsonMatch = resultText.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
        if (!jsonMatch) {
          const fallback: { tasks: AnalyzedTask[] } = {
            tasks: [
              {
                title: title.trim(),
                description: description.trim() || title.trim(),
                priority: "medium",
                criteria: ["Complete the requested work"],
                scope: [],
                context: [],
                depends_on: [],
                role: "general",
              },
            ],
          };
          settle(
            new Response(JSON.stringify(fallback), {
              headers: { "Content-Type": "application/json" },
            }),
          );
          return;
        }

        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
          throw new Error("Invalid response structure");
        }

        // Validate and sanitize
        const tasks: AnalyzedTask[] = parsed.tasks.map(
          (t: Record<string, unknown>) => ({
            title: typeof t.title === "string" ? t.title : title.trim(),
            description: typeof t.description === "string" ? t.description : "",
            priority: ["high", "medium", "low"].includes(t.priority as string)
              ? (t.priority as "high" | "medium" | "low")
              : "medium",
            criteria: Array.isArray(t.criteria)
              ? t.criteria.filter((c: unknown) => typeof c === "string")
              : [],
            scope: Array.isArray(t.scope)
              ? t.scope.filter((s: unknown) => typeof s === "string")
              : [],
            context: Array.isArray(t.context)
              ? t.context.filter((s: unknown) => typeof s === "string")
              : [],
            depends_on: Array.isArray(t.depends_on)
              ? t.depends_on.filter((d: unknown) => typeof d === "number")
              : [],
            role:
              typeof t.role === "string" && getAvailableRoles().includes(t.role)
                ? t.role
                : "general",
          }),
        );

        settle(
          new Response(JSON.stringify({ tasks }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      } catch {
        settle(
          new Response(
            JSON.stringify({
              tasks: [
                {
                  title: title.trim(),
                  description: description.trim() || title.trim(),
                  priority: "medium",
                  criteria: ["Complete the requested work"],
                  scope: [],
                  context: [],
                  role: "general",
                },
              ],
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        );
      }
    });

    child.on("error", (err) => {
      if (settled) return;
      appendDashboardAiConversationLog({
        phase: usagePhase,
        model: CLAUDE_DEFAULT_MODEL,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        spawnError: err.message,
        prompt,
        stdout,
        stderr,
      });
      const isNotFound = err.message.includes("ENOENT");
      settle(
        jsonErrorResponse({
          error: isNotFound
            ? "Claude CLI not found. Install it first: https://docs.anthropic.com/en/docs/claude-cli"
            : `Claude CLI error: ${err.message}`,
          status: 500,
          code: isNotFound ? "CLI_NOT_FOUND" : "CLI_ERROR",
        }),
      );
    });
  });
}
