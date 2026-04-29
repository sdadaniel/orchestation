import fs from "fs";
import path from "path";
import { z } from "zod";
import { registerRpc } from "../registry";

const PACKAGE_DIR = path.resolve(__dirname, "..", "..", "..");
const WORKSPACE_ROOT = path.resolve(PACKAGE_DIR, "..", "..");
const PROJECT_ROOT = process.env.PROJECT_ROOT ?? WORKSPACE_ROOT;
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, "output");
const ORCH_OUTPUT_DIR = path.resolve(PROJECT_ROOT, ".orchestration", "output");

function readConversationLines(taskId: string): string[] {
  const suffixes = [
    "-task-conversation.jsonl",
    "-review-conversation.jsonl",
  ];
  const orderedFiles = [
    ...suffixes.map((suffix) => path.resolve(OUTPUT_DIR, `${taskId}${suffix}`)),
    ...suffixes.map((suffix) =>
      path.resolve(ORCH_OUTPUT_DIR, `${taskId}${suffix}`),
    ),
  ];

  const lines: string[] = [];
  const seen = new Set<string>();

  for (const filePath of orderedFiles) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf-8");
    for (const raw of content.split("\n")) {
      const line = raw.trim();
      if (!line || seen.has(line)) continue;
      seen.add(line);
      lines.push(line);
    }
  }

  return lines;
}

registerRpc({
  name: "task.conversation.get",
  idempotent: true,
  paramsSchema: z.object({ taskId: z.string().min(1) }).strict(),
  handler: ({ taskId }) => ({ lines: readConversationLines(taskId) }),
});
