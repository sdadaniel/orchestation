import { spawn } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PROJECT_ROOT = path.resolve(process.cwd(), "../..");

interface AnalyzedTask {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  criteria: string[];
}

export async function POST(request: Request) {
  let title: string;
  let description: string;

  try {
    const body = await request.json();
    title = body.title;
    description = body.description || "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!title || typeof title !== "string" || !title.trim()) {
    return new Response(JSON.stringify({ error: "title is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = `You are a task analysis assistant. Analyze the following request and break it down into actionable tasks.

Request title: ${title.trim()}
${description.trim() ? `Description: ${description.trim()}` : ""}

Rules:
- If the request is simple, return 1 task. If complex, split into 2-5 tasks.
- Each task must have: title, description, priority (high/medium/low), criteria (completion criteria as string array).
- Return ONLY valid JSON in this exact format, no markdown, no explanation:
{"tasks":[{"title":"...","description":"...","priority":"medium","criteria":["criterion 1","criterion 2"]}]}`;

  return new Promise<Response>((resolve) => {
    const child = spawn(
      "claude",
      ["--print", "--model", "claude-sonnet-4-6", "--output-format", "text"],
      {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    child.stdin.write(prompt);
    child.stdin.end();

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error("Claude CLI stderr:", stderr);
        resolve(
          new Response(
            JSON.stringify({ error: "AI analysis failed. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          ),
        );
        return;
      }

      try {
        // Extract JSON from response (may have surrounding text)
        const jsonMatch = stdout.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
        if (!jsonMatch) {
          // Fallback: create a single task from the original request
          const fallback: { tasks: AnalyzedTask[] } = {
            tasks: [
              {
                title: title.trim(),
                description: description.trim() || title.trim(),
                priority: "medium",
                criteria: ["Complete the requested work"],
              },
            ],
          };
          resolve(
            new Response(JSON.stringify(fallback), {
              headers: { "Content-Type": "application/json" },
            }),
          );
          return;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
          throw new Error("Invalid response structure");
        }

        // Validate and sanitize
        const tasks: AnalyzedTask[] = parsed.tasks.map(
          (t: Record<string, unknown>) => ({
            title: typeof t.title === "string" ? t.title : title.trim(),
            description:
              typeof t.description === "string" ? t.description : "",
            priority: ["high", "medium", "low"].includes(t.priority as string)
              ? (t.priority as "high" | "medium" | "low")
              : "medium",
            criteria: Array.isArray(t.criteria)
              ? t.criteria.filter((c: unknown) => typeof c === "string")
              : [],
          }),
        );

        resolve(
          new Response(JSON.stringify({ tasks }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      } catch (err) {
        console.error("Failed to parse AI response:", stdout);
        // Fallback
        resolve(
          new Response(
            JSON.stringify({
              tasks: [
                {
                  title: title.trim(),
                  description: description.trim() || title.trim(),
                  priority: "medium",
                  criteria: ["Complete the requested work"],
                },
              ],
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        );
      }
    });

    child.on("error", (err) => {
      console.error("Claude CLI spawn error:", err.message);
      resolve(
        new Response(
          JSON.stringify({ error: "Failed to call AI. Please try again." }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        ),
      );
    });

    // 90s timeout
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolve(
        new Response(
          JSON.stringify({ error: "Analysis timed out. Please try again." }),
          { status: 504, headers: { "Content-Type": "application/json" } },
        ),
      );
    }, 90000);

    child.on("close", () => clearTimeout(timeout));
  });
}
