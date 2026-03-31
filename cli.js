#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ORCH_DIR = ".orchestration";
const SCRIPTS_DIR = path.join(__dirname, "scripts");
const FRONTEND_DIR = path.join(__dirname, "src", "frontend");

const command = process.argv[2];
const args = process.argv.slice(3);

// ── Helpers ──────────────────────────────────────────────────────

function ensureOrchDir() {
  const dirs = [
    ORCH_DIR,
    path.join(ORCH_DIR, "tasks"),
    path.join(ORCH_DIR, "signals"),
    path.join(ORCH_DIR, "notices"),
    path.join(ORCH_DIR, "output", "logs"),
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function ensureConfig() {
  const configPath = path.join(ORCH_DIR, "config.json");
  if (!fs.existsSync(configPath)) {
    const defaults = {
      claudeApiKey: "",
      srcPaths: ["src/"],
      model: "claude-sonnet-4-6",
      maxParallel: { task: 2, review: 2 },
      maxReviewRetry: 2,
      workerMode: "background",
      nightWorker: {
        until: "07:00",
        budget: null,
        maxTasks: 10,
        types: "typecheck,lint,review",
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2) + "\n");
    console.log("  Created .orchestration/config.json");
  }
}

/**
 * Check that a CLI tool is available on PATH.
 * Returns true if found, false otherwise (prints error).
 */
function checkBinary(name, hint) {
  try {
    execSync(`which ${name}`, { stdio: "pipe" });
    return true;
  } catch {
    console.error(`  [MISSING] '${name}' not found.${hint ? " " + hint : ""}`);
    return false;
  }
}

/**
 * Verify bash version >= 3.
 * Returns true if OK, false otherwise.
 */
function checkBashVersion() {
  try {
    const out = execSync("bash --version", { stdio: "pipe", encoding: "utf-8" });
    const match = out.match(/version\s+(\d+)/);
    if (match && parseInt(match[1], 10) >= 3) {
      return true;
    }
    console.error("  [MISSING] bash >= 3 is required. Found:", out.split("\n")[0]);
    return false;
  } catch {
    console.error("  [MISSING] bash not found.");
    return false;
  }
}

/**
 * Run all dependency checks. Returns true if all pass.
 */
function checkDependencies() {
  console.log("Checking dependencies...");

  const results = [
    checkBinary("claude", "Install: https://docs.anthropic.com/en/docs/claude-cli"),
    checkBinary("git", "Install: https://git-scm.com/downloads"),
    checkBinary("jq", "Install: brew install jq (macOS) / apt install jq (Linux)"),
    checkBashVersion(),
  ];

  const allOk = results.every(Boolean);
  if (allOk) {
    console.log("  All dependencies found.\n");
  } else {
    console.error("\nPlease install missing dependencies and retry.\n");
  }
  return allOk;
}

function ensureGitignore() {
  const gitignorePath = ".gitignore";
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.includes(".orchestration")) {
      fs.appendFileSync(gitignorePath, "\n# Orchestration\n.orchestration/\n");
      console.log("  Added .orchestration/ to .gitignore");
    }
  } else {
    fs.writeFileSync(gitignorePath, "# Orchestration\n.orchestration/\n");
    console.log("  Created .gitignore with .orchestration/");
  }
}

function printHelp() {
  const pkg = require(path.join(__dirname, "package.json"));
  console.log(`orchestrate v${pkg.version} — AI Development Orchestration CLI\n`);
  console.log("Usage:  orchestrate <command> [options]\n");
  console.log("Commands:");
  console.log("  init        Initialize project (creates .orchestration/)");
  console.log("  run         Run the orchestration pipeline");
  console.log("  night       Start Night Worker (autonomous overnight runs)");
  console.log("  dashboard   Launch the web dashboard (localhost:3000)");
  console.log("  status      Show current orchestration status");
  console.log("");
  console.log("Options (run / night):");
  console.log("  --until HH:MM       Stop time");
  console.log("  --budget N          Budget limit (USD)");
  console.log("  --max-tasks N       Maximum tasks to process");
  console.log("");
  console.log("General:");
  console.log("  --help, -h          Show this help message");
  console.log("  --version, -v       Show version");
}

function printVersion() {
  const pkg = require(path.join(__dirname, "package.json"));
  console.log(`orchestrate v${pkg.version}`);
}

// ── Commands ─────────────────────────────────────────────────────

// Handle --help / -h / --version / -v before command dispatch
if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}
if (command === "--version" || command === "-v") {
  printVersion();
  process.exit(0);
}

switch (command) {
  case "init": {
    console.log("Initializing orchestration...\n");

    if (!checkDependencies()) {
      process.exit(1);
    }

    ensureOrchDir();
    console.log("  Created .orchestration/ directories");

    ensureConfig();
    ensureGitignore();

    console.log("\nInitialization complete!\n");
    console.log("Next steps:");
    console.log("  1. Set claudeApiKey in .orchestration/config.json");
    console.log("  2. orchestrate dashboard  — launch the web dashboard");
    console.log("  3. orchestrate run        — run the pipeline");
    break;
  }

  case "dashboard": {
    ensureOrchDir();

    const frontendPkg = path.join(FRONTEND_DIR, "package.json");
    if (!fs.existsSync(frontendPkg)) {
      console.error("Error: Frontend not found at", FRONTEND_DIR);
      console.error("Make sure the package was installed correctly.");
      process.exit(1);
    }

    console.log("Starting dashboard...");
    const dashProc = spawn("npm", ["run", "dev"], {
      cwd: FRONTEND_DIR,
      stdio: "inherit",
      env: { ...process.env },
    });
    dashProc.on("error", (err) => {
      console.error("Failed to start dashboard:", err.message);
      process.exit(1);
    });
    break;
  }

  case "run": {
    ensureOrchDir();

    const scriptPath = path.join(SCRIPTS_DIR, "orchestrate.sh");
    if (!fs.existsSync(scriptPath)) {
      console.error("Error: orchestrate.sh not found at", scriptPath);
      process.exit(1);
    }

    console.log("Running orchestration pipeline...");
    const runProc = spawn("bash", [scriptPath, ...args], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: { ...process.env, PACKAGE_DIR: __dirname, PROJECT_ROOT: process.cwd() },
    });
    runProc.on("error", (err) => {
      console.error("Failed to run pipeline:", err.message);
      process.exit(1);
    });
    runProc.on("close", (code) => process.exit(code || 0));
    break;
  }

  case "night": {
    ensureOrchDir();

    const nightScript = path.join(SCRIPTS_DIR, "night-worker.sh");
    if (!fs.existsSync(nightScript)) {
      console.error("Error: night-worker.sh not found at", nightScript);
      process.exit(1);
    }

    console.log("Starting Night Worker...");
    const nightProc = spawn("bash", [nightScript, ...args], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: { ...process.env, PACKAGE_DIR: __dirname, PROJECT_ROOT: process.cwd() },
    });
    nightProc.on("error", (err) => {
      console.error("Failed to start Night Worker:", err.message);
      process.exit(1);
    });
    nightProc.on("close", (code) => process.exit(code || 0));
    break;
  }

  case "status": {
    ensureOrchDir();

    const configPath = path.join(ORCH_DIR, "config.json");
    if (!fs.existsSync(configPath)) {
      console.error("Error: config.json not found. Run 'orchestrate init' first.");
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const tasksDir = path.join(ORCH_DIR, "tasks");
    const tasks = fs.existsSync(tasksDir)
      ? fs.readdirSync(tasksDir).filter((f) => f.endsWith(".md"))
      : [];

    // Count tasks by status (best-effort: read frontmatter)
    const statusCounts = {};
    for (const t of tasks) {
      try {
        const content = fs.readFileSync(path.join(tasksDir, t), "utf-8");
        const match = content.match(/^status:\s*(\S+)/m);
        const st = match ? match[1] : "unknown";
        statusCounts[st] = (statusCounts[st] || 0) + 1;
      } catch {
        statusCounts["unknown"] = (statusCounts["unknown"] || 0) + 1;
      }
    }

    console.log("Orchestration Status");
    console.log("────────────────────────────");
    console.log(`  API Key:    ${config.claudeApiKey ? "configured" : "NOT SET"}`);
    console.log(`  Model:      ${config.model}`);
    console.log(`  Src paths:  ${config.srcPaths.join(", ")}`);
    console.log(`  Parallel:   task=${config.maxParallel?.task ?? "?"}, review=${config.maxParallel?.review ?? "?"}`);
    console.log(`  Tasks:      ${tasks.length} total`);

    if (Object.keys(statusCounts).length > 0) {
      const breakdown = Object.entries(statusCounts)
        .map(([s, n]) => `${s}=${n}`)
        .join(", ");
      console.log(`              ${breakdown}`);
    }
    break;
  }

  default: {
    console.error(`Unknown command: '${command}'\n`);
    printHelp();
    process.exit(1);
  }
}
