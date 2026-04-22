import fs from "fs";
import path from "path";
import { getErrorMessage } from "../lib/error-utils";
import { PROJECT_ROOT, OUTPUT_DIR } from "../lib/paths";
import { loadSettings } from "../lib/settings";
import { runClaudeJson } from "./claude-worker";
import {
  parseFrontmatter,
  getString,
  getStringArray,
} from "../lib/frontmatter-utils";
import {
  createTask,
  getNextTaskId,
  getTasksByStatus,
} from "../service/task-store";
import { OrchestrateEngine } from "./orchestrate-engine";

export type AutoImproveStatus =
  | "idle"
  | "running"
  | "stopping"
  | "completed"
  | "failed";

export interface AutoImproveState {
  status: AutoImproveStatus;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  exitCode: number | null;
}

const SLEEP_INTERVAL_MS = 30_000;

class AutoImproveManager {
  private state: AutoImproveState = {
    status: "idle",
    startedAt: null,
    finishedAt: null,
    logs: [],
    exitCode: null,
  };

  private shouldStop = false;
  private loopPromise: Promise<void> | null = null;
  private engine: OrchestrateEngine | null = null;

  getState(): AutoImproveState {
    return { ...this.state, logs: [...this.state.logs] };
  }

  getStatus(): AutoImproveStatus {
    return this.state.status;
  }

  getLogs(since: number = 0): string[] {
    return this.state.logs.slice(since);
  }

  isRunning(): boolean {
    return this.state.status === "running" || this.state.status === "stopping";
  }

  run(): { success: boolean; error?: string } {
    if (this.isRunning()) {
      return { success: false, error: "Auto-improve is already running" };
    }

    this.shouldStop = false;

    this.state = {
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logs: [],
      exitCode: null,
    };

    this.appendLog(`[auto-improve] Starting at ${this.state.startedAt}`);
    this.appendLog(`[auto-improve] CWD: ${PROJECT_ROOT}`);

    this.loopPromise = this.mainLoop().catch((err) => {
      const msg = getErrorMessage(err, String(err));
      this.appendLog(`[auto-improve] Fatal error: ${msg}`);
      this.state.status = "failed";
      this.state.exitCode = 1;
      this.state.finishedAt = new Date().toISOString();
    });

    return { success: true };
  }

  stop(): { success: boolean; error?: string } {
    if (this.state.status !== "running") {
      return { success: false, error: "Auto-improve is not running" };
    }

    this.appendLog("[auto-improve] Graceful stop requested by user");
    this.state.status = "stopping";
    this.shouldStop = true;

    // Stop engine if running
    if (this.engine) {
      this.engine.stop();
      this.engine = null;
    }

    return { success: true };
  }

  private async mainLoop(): Promise<void> {
    const requestsDir = path.join(PROJECT_ROOT, "docs", "requests");

    while (!this.shouldStop) {
      // Step 0: Run orchestration for already-pending tasks
      const pendingTasks = getTasksByStatus("pending", "stopped");
      if (pendingTasks.length > 0) {
        this.appendLog(
          `[auto-improve] Found ${pendingTasks.length} pending task(s) - running orchestration...`,
        );
        await this.runOrchestration();
        if (this.shouldStop) break;
      }

      // Step 1: Collect pending requests
      if (!fs.existsSync(requestsDir)) {
        this.appendLog("[auto-improve] No requests directory. Sleeping...");
        await this.sleep(SLEEP_INTERVAL_MS);
        continue;
      }

      const pendingRequests = this.collectPendingRequests(requestsDir);
      if (pendingRequests.length === 0) {
        this.appendLog("[auto-improve] No pending requests. Sleeping...");
        await this.sleep(SLEEP_INTERVAL_MS);
        continue;
      }

      this.appendLog(
        `[auto-improve] Found ${pendingRequests.length} pending request(s)`,
      );

      // Step 2: Evaluate each request
      const accepted: { file: string; id: string; evalResult: string }[] = [];

      for (const req of pendingRequests) {
        if (this.shouldStop) break;

        this.appendLog(`[auto-improve] Evaluating ${req.id}: ${req.title}...`);
        this.updateRequestStatus(req.file, "in_progress");

        const evalResult = await this.evaluateRequest(req);
        const decision = this.parseEvalDecision(evalResult);

        if (decision !== "accept") {
          const reason = this.parseEvalField(evalResult, "REASON");
          this.updateRequestStatus(req.file, "rejected");
          fs.appendFileSync(
            req.file,
            `\n---\n**Rejected:** ${reason}\n**At:** ${new Date().toISOString()}\n`,
          );
          this.appendLog(`[auto-improve] Rejected ${req.id}: ${reason}`);
        } else {
          this.appendLog(`[auto-improve] Accepted ${req.id}`);
          accepted.push({ file: req.file, id: req.id, evalResult });
        }
      }

      if (accepted.length === 0) {
        this.appendLog("[auto-improve] All requests rejected. Continuing...");
        await this.sleep(2000);
        continue;
      }

      // Step 3: Enrich accepted requests and create tasks
      for (const req of accepted) {
        if (this.shouldStop) break;
        this.enrichAndCreateTask(req.file, req.id, req.evalResult);
      }

      // Step 4: Run orchestration for newly created tasks
      await this.runOrchestration();

      this.appendLog(
        `[auto-improve] Batch complete: ${accepted.length} accepted, ${pendingRequests.length - accepted.length} rejected`,
      );
      await this.sleep(2000);
    }

    this.state.status = this.shouldStop ? "completed" : "completed";
    this.state.exitCode = 0;
    this.state.finishedAt = new Date().toISOString();
    this.appendLog(`[auto-improve] Stopped at ${this.state.finishedAt}`);
  }

  private collectPendingRequests(dir: string): {
    file: string;
    id: string;
    title: string;
    priority: string;
    body: string;
  }[] {
    const results: {
      file: string;
      id: string;
      title: string;
      priority: string;
      body: string;
    }[] = [];

    try {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const { data } = parseFrontmatter(content);

        const status = getString(data, "status");
        if (status !== "new" && status !== "pending") continue;

        const id = getString(data, "id") || file.replace(/\.md$/, "");
        const title = getString(data, "title") || "";
        const priority = getString(data, "priority") || "medium";

        // Extract body (after frontmatter)
        let body = content;
        if (content.startsWith("---")) {
          const endIdx = content.indexOf("---", 3);
          if (endIdx !== -1) body = content.slice(endIdx + 3).trim();
        }

        results.push({ file: filePath, id, title, priority, body });
      }
    } catch {
      /* ignore */
    }

    return results;
  }

  private async evaluateRequest(req: {
    id: string;
    title: string;
    priority: string;
    body: string;
  }): Promise<string> {
    const prompt = `You are a software development task manager.

Analyze the following improvement request and decide if it's actionable.

Request ID: ${req.id}
Title: ${req.title}
Priority: ${req.priority}
Content: ${req.body}

Criteria:
- Is the request specific? (Can you identify which files, features, or changes?)
- Is the scope clear? (Can it be completed as a single task?)
- Is it vague or abstract? ("make it better", "improve" without specifics?)

Respond ONLY in this format:
DECISION: accept or reject
REASON: one-line reason
TASK_TITLE: (if accept) task title
TASK_DESCRIPTION: (if accept) specific completion criteria
SCOPE: (if accept) target file paths (comma-separated, relative to src/)`;

    try {
      const result = await runClaudeJson({
        prompt,
        model: "claude-sonnet-4-6",
        cwd: PROJECT_ROOT,
        timeout: 60_000,
        onLine: (line) => this.appendLog(`  ${line}`),
      });
      return (
        result.result || "DECISION: reject\nREASON: Empty response from Claude"
      );
    } catch (err) {
      return `DECISION: reject\nREASON: Evaluation failed: ${getErrorMessage(err, "unknown")}`;
    }
  }

  private enrichAndCreateTask(
    reqFile: string,
    reqId: string,
    evalResult: string,
  ): void {
    const taskTitle = this.parseEvalField(evalResult, "TASK_TITLE") || reqId;
    const taskDesc = this.parseEvalField(evalResult, "TASK_DESCRIPTION") || "";
    const scopeLine = this.parseEvalField(evalResult, "SCOPE") || "";
    const scope = scopeLine
      ? scopeLine
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const nextId = getNextTaskId();

    createTask({
      id: nextId,
      title: taskTitle,
      status: "pending",
      priority: "medium",
      role: "general",
      scope,
      depends_on: [],
      content: taskDesc,
    });

    // Update request status
    this.updateRequestStatus(reqFile, "processed");
    this.appendLog(`[auto-improve] Created task ${nextId}: ${taskTitle}`);
  }

  private async runOrchestration(): Promise<void> {
    this.appendLog("[auto-improve] Starting orchestration engine...");

    this.engine = new OrchestrateEngine();
    this.engine.on("log", (line: string) =>
      this.appendLog(`  [engine] ${line}`),
    );

    const result = this.engine.start();
    if (!result.success) {
      this.appendLog(`[auto-improve] Engine start failed: ${result.error}`);
      this.engine = null;
      return;
    }

    // Wait for engine to finish or be stopped
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (
          !this.engine ||
          this.engine.status !== "running" ||
          this.shouldStop
        ) {
          clearInterval(check);
          if (this.engine) {
            this.engine.stop();
            this.engine = null;
          }
          resolve();
        }
      }, 3000);
    });

    this.appendLog("[auto-improve] Orchestration complete");
  }

  private parseEvalDecision(evalResult: string): string {
    const match = evalResult.match(/^DECISION:\s*(\S+)/m);
    return match ? match[1].toLowerCase() : "reject";
  }

  private parseEvalField(evalResult: string, field: string): string {
    const match = evalResult.match(new RegExp(`^${field}:\\s*(.+)`, "m"));
    return match ? match[1].trim() : "";
  }

  private updateRequestStatus(file: string, newStatus: string): void {
    try {
      let content = fs.readFileSync(file, "utf-8");
      content = content.replace(/^status:\s*.*/m, `status: ${newStatus}`);
      fs.writeFileSync(file, content);
    } catch {
      /* ignore */
    }
  }

  private async sleep(ms: number): Promise<void> {
    const chunks = Math.ceil(ms / 100);
    for (let i = 0; i < chunks; i++) {
      if (this.shouldStop) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private appendLog(line: string) {
    this.state.logs.push(line);
  }
}

// Singleton
const globalKey = "__autoImproveManager__" as keyof typeof globalThis;
const autoImproveManager: AutoImproveManager =
  ((globalThis as Record<string, unknown>)[globalKey] as AutoImproveManager) ??
  (() => {
    const m = new AutoImproveManager();
    (globalThis as Record<string, unknown>)[globalKey] = m;
    return m;
  })();
export default autoImproveManager;
