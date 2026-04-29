#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { pathToFileURL } = require("url");

const ORCH_DIR = ".orchestration";
const FRONTEND_DIR = path.join(__dirname, "packages", "dashboard");
const RUNTIME_DIR = path.join(__dirname, "packages", "engine");
const GATEWAY_DIR = path.join(__dirname, "packages", "gateway");

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
 * Verify Node.js version >= 18.
 * Returns true if OK, false otherwise.
 */
function checkNodeVersion() {
  const major = parseInt(process.versions.node.split(".")[0], 10);
  if (major >= 18) return true;
  console.error(`  [MISSING] Node.js >= 18 is required. Found: ${process.versions.node}`);
  return false;
}

/**
 * Run all dependency checks. Returns true if all pass.
 */
function checkDependencies() {
  console.log("Checking dependencies...");

  const results = [
    checkBinary("claude", "Install: https://docs.anthropic.com/en/docs/claude-cli"),
    checkBinary("git", "Install: https://git-scm.com/downloads"),
    checkNodeVersion(),
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
  console.log("  start [-p PORT]  Init + deps + dashboard (background) + run pipeline (foreground)");
  console.log("  stop             Stop dashboard + pipeline");
  console.log("  restart          Restart dashboard + pipeline (stop both, then start)");
  console.log("  init        Initialize project (creates .orchestration/)");
  console.log("  run         Run the orchestration pipeline only (no dashboard)");
  console.log("  night       Start Night Worker (autonomous overnight runs)");
  console.log("  dashboard   Launch the web dashboard (localhost:3000)");
  console.log("  status      Dashboard/gateway reachability + run-engine + project summary");
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

/** Remove -p / --port and its value (dashboard bind port, not passed to run-engine). */
function stripDashboardPortArgs(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "-p" || argv[i] === "--port") {
      if (i + 1 < argv.length) i++;
      continue;
    }
    out.push(argv[i]);
  }
  return out;
}

/** HTTP GET / on loopback — true if something responds with a non–5xx status (e.g. Next.js dev server). */
function probeDashboardHttp(hostname, port, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname, port, path: "/", timeout: timeoutMs, family: 4 },
      (res) => {
        res.resume();
        resolve(res.statusCode != null && res.statusCode < 500);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function findListeningDashboardPort(hostname, lo, hi, timeoutMs) {
  for (let p = lo; p <= hi; p++) {
    if (await probeDashboardHttp(hostname, p, timeoutMs)) return p;
  }
  return null;
}

function findRunEnginePids() {
  try {
    const out = execSync('pgrep -f "run-engine\\.ts" 2>/dev/null || true', { encoding: "utf-8" });
    const pids = out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => parseInt(line.trim().split(/\s+/)[0], 10))
      .filter((n) => !Number.isNaN(n));
    if (pids.length <= 1) return pids;

    // tsx often spawns a child node process; collapse parent+child into a single "top-level" pid.
    // We treat any pid whose parent is ALSO in the list as a child and hide it from display.
    const psOut = execSync(`ps -o pid=,ppid= -p ${pids.join(",")}`, { encoding: "utf-8" });
    const parentByPid = new Map();
    for (const line of psOut.trim().split("\n")) {
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[0], 10);
      const ppid = parseInt(parts[1], 10);
      if (!Number.isNaN(pid) && !Number.isNaN(ppid)) parentByPid.set(pid, ppid);
    }

    const pidSet = new Set(pids);
    return pids.filter((pid) => {
      const ppid = parentByPid.get(pid);
      return ppid == null || !pidSet.has(ppid);
    });
  } catch {
    return [];
  }
}

function findDashboardPids() {
  try {
    const out = execSync('pgrep -f "gateway/src/server\\.ts" 2>/dev/null || true', { encoding: "utf-8" });
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => parseInt(line.trim().split(/\s+/)[0], 10))
      .filter((n) => !Number.isNaN(n));
  } catch {
    return [];
  }
}

function killPids(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // ignore
    }
  }
}

function resolveTsxLoaderPaths() {
  const tsxInRuntime = path.join(RUNTIME_DIR, "node_modules", "tsx");
  const tsxInDashboard = path.join(FRONTEND_DIR, "node_modules", "tsx");
  const tsxDir = fs.existsSync(tsxInRuntime) ? tsxInRuntime : tsxInDashboard;

  const preflight = path.join(tsxDir, "dist", "preflight.cjs");
  const loader = path.join(tsxDir, "dist", "loader.mjs");
  if (!fs.existsSync(preflight) || !fs.existsSync(loader)) {
    throw new Error(`tsx loader files not found under ${tsxDir}/dist`);
  }
  return { preflight, loader };
}

function spawnTsxNode(scriptPath, scriptArgs, spawnOpts) {
  const { preflight, loader } = resolveTsxLoaderPaths();
  const loaderUrl = pathToFileURL(loader).toString();
  return spawn(
    process.execPath,
    ["--require", preflight, "--import", loaderUrl, scriptPath, ...scriptArgs],
    spawnOpts
  );
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
  case "start": {
    // init + deps + dashboard (background) + run pipeline (foreground)
    void (async () => {
      // If already running, don't spawn anything again.
      const HOST = "127.0.0.1";
      const alreadyDashPort = await findListeningDashboardPort(HOST, 3000, 3019, 200).catch(() => null);
      const alreadyEnginePids = findRunEnginePids();
      if (process.env.ORCH_FORCE_START !== "1") {
        if (alreadyDashPort != null && alreadyEnginePids.length > 0) {
          console.log("Already running.");
          console.log(`Dashboard: http://${HOST}:${alreadyDashPort}/`);
          console.log(`Gateway:   ws://${HOST}:${alreadyDashPort}/ws/gateway`);
          console.log(`Pipeline:  run-engine pid(s): ${alreadyEnginePids.join(", ")}`);
          return;
        }
      }

      const orchExists = fs.existsSync(ORCH_DIR);
      if (!orchExists) {
        console.log("Initializing orchestration...\n");
        if (!checkDependencies()) {
          process.exit(1);
        }
        ensureOrchDir();
        ensureConfig();
        ensureGitignore();
        console.log("  Initialization complete.\n");
      }

    const frontendPkg = path.join(FRONTEND_DIR, "package.json");
    if (!fs.existsSync(frontendPkg)) {
      console.error("Error: Frontend source not found at", FRONTEND_DIR);
      console.error("Make sure the package was installed correctly.");
      process.exit(1);
    }

    // Install frontend dependencies if node_modules missing
    const frontendNodeModules = path.join(FRONTEND_DIR, "node_modules");
    if (!fs.existsSync(frontendNodeModules)) {
      console.log("Installing dashboard dependencies (first run)...");
      try {
        execSync("npm install --production=false", {
          cwd: FRONTEND_DIR,
          stdio: "inherit",
        });
        console.log("  Dependencies installed.\n");
      } catch (err) {
        console.error("Failed to install dashboard dependencies.");
        process.exit(1);
      }
    }

    const runtimeNodeModules = path.join(RUNTIME_DIR, "node_modules");
    if (!fs.existsSync(runtimeNodeModules)) {
      console.log("Installing engine package dependencies (first run)...");
      try {
        execSync("npm install --production=false", {
          cwd: RUNTIME_DIR,
          stdio: "inherit",
        });
        console.log("  Runtime dependencies installed.\n");
      } catch (err) {
        console.error("Failed to install engine package dependencies.");
        process.exit(1);
      }
    }

    const gatewayNodeModules = path.join(GATEWAY_DIR, "node_modules");
    if (fs.existsSync(GATEWAY_DIR) && !fs.existsSync(gatewayNodeModules)) {
      console.log("Installing gateway dependencies (first run)...");
      try {
        execSync("npm install --production=false", {
          cwd: GATEWAY_DIR,
          stdio: "inherit",
        });
        console.log("  Gateway-host dependencies installed.\n");
      } catch (err) {
        console.error("Failed to install gateway dependencies.");
        process.exit(1);
      }
    }

    // Port: -p flag > find available port starting from 3000
    const net = require("net");
    let requestedPort = 3000;
    const pIdx = args.indexOf("-p");
    if (pIdx !== -1 && args[pIdx + 1]) {
      requestedPort = parseInt(args[pIdx + 1], 10);
      if (isNaN(requestedPort)) {
        console.error("Error: Invalid port number:", args[pIdx + 1]);
        process.exit(1);
      }
    }

    function isPortFree(port) {
      return new Promise((resolve) => {
        const srv = net.createServer();
        srv.once("error", () => resolve(false));
        srv.once("listening", () => { srv.close(); resolve(true); });
        srv.listen(port);
      });
    }

    async function findPort(start) {
      for (let p = start; p < start + 20; p++) {
        if (await isPortFree(p)) return p;
      }
      return null;
    }

      const runEngineArgs = stripDashboardPortArgs(args);

      findPort(requestedPort).then((port) => {
        if (!port) {
          console.error(`Error: No available port found (tried ${requestedPort}-${requestedPort + 19})`);
          process.exit(1);
        }
        // Only mention port fallback if we're actually going to use that port
        // (i.e. dashboard isn't already running on an existing port).
        if (alreadyDashPort == null && port !== requestedPort && pIdx === -1) {
          console.log(`Port ${requestedPort} in use, using ${port} instead.`);
        }
        const dashPort = alreadyDashPort ?? port;
        const enginePids = alreadyEnginePids;

        if (alreadyDashPort != null) {
          console.log(`Dashboard already running: http://${HOST}:${alreadyDashPort}/`);
        } else {
          console.log(`Dashboard (background): http://localhost:${dashPort}\n`);

          const dashProc = spawn("npm", ["run", "dev"], {
            cwd: FRONTEND_DIR,
            detached: true,
            stdio: "ignore",
            env: { ...process.env, PACKAGE_DIR: __dirname, PROJECT_ROOT: process.cwd(), PORT: String(dashPort) },
          });
          dashProc.on("error", (err) => {
            console.error("Failed to start dashboard:", err.message);
            process.exit(1);
          });
          dashProc.unref();
        }

        if (enginePids.length > 0) {
          console.log(`Pipeline already running: pid(s) ${enginePids.join(", ")}`);
          process.exit(0);
        }

      const engineScript = path.join(RUNTIME_DIR, "src", "cli", "run-engine.ts");

      if (!fs.existsSync(engineScript)) {
        console.error("Error: run-engine.ts not found at", engineScript);
        process.exit(1);
      }

        console.log("Starting pipeline (background)...\n");
        const runProc = spawnTsxNode(engineScript, runEngineArgs, {
          cwd: RUNTIME_DIR,
          detached: true,
          stdio: "ignore",
          env: { ...process.env, PACKAGE_DIR: __dirname, PROJECT_ROOT: process.cwd() },
        });
        runProc.on("error", (err) => {
          console.error("Failed to start pipeline:", err.message);
          process.exit(1);
        });
        runProc.unref();
        if (runProc?.pid) {
          console.log(`Pipeline started (background): pid ${runProc.pid}\n`);
        }
      });
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  }

  case "stop": {
    void (async () => {
      const dashPids = findDashboardPids();
      const enginePids = findRunEnginePids();

      if (dashPids.length === 0 && enginePids.length === 0) {
        console.log("Nothing to stop (dashboard and pipeline are not running).");
        return;
      }

      if (dashPids.length > 0) console.log(`Stopping dashboard: pid(s) ${dashPids.join(", ")}`);
      if (enginePids.length > 0) console.log(`Stopping pipeline:  pid(s) ${enginePids.join(", ")}`);

      killPids([...enginePids, ...dashPids], "SIGTERM");
      await new Promise((r) => setTimeout(r, 600));
      killPids([...enginePids, ...dashPids], "SIGKILL");
      await new Promise((r) => setTimeout(r, 200));

      console.log("Stopped.");
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  }

  case "restart": {
    void (async () => {
      const dashPids = findDashboardPids();
      const enginePids = findRunEnginePids();

      if (dashPids.length === 0 && enginePids.length === 0) {
        console.log("Nothing to restart (dashboard and pipeline are not running).");
      } else {
        if (dashPids.length > 0) console.log(`Stopping dashboard: pid(s) ${dashPids.join(", ")}`);
        if (enginePids.length > 0) console.log(`Stopping pipeline:  pid(s) ${enginePids.join(", ")}`);

        killPids([...enginePids, ...dashPids], "SIGTERM");
        await new Promise((r) => setTimeout(r, 600));
        killPids([...enginePids, ...dashPids], "SIGKILL");
        await new Promise((r) => setTimeout(r, 300));
      }

      const proc = spawn(process.execPath, [__filename, "start", ...args], {
        stdio: "inherit",
        env: { ...process.env, ORCH_FORCE_START: "1" },
      });
      proc.on("error", (err) => {
        console.error("Failed to restart:", err.message);
        process.exit(1);
      });
      proc.on("close", (code) => process.exit(code || 0));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  }

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

  case "dashboard":
  case "gateway": {
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

    const runtimeNodeModulesRun = path.join(RUNTIME_DIR, "node_modules");
    if (!fs.existsSync(runtimeNodeModulesRun)) {
      console.log("Installing engine package dependencies (first run)...");
      try {
        execSync("npm install --production=false", {
          cwd: RUNTIME_DIR,
          stdio: "inherit",
        });
      } catch (err) {
        console.error("Failed to install engine package dependencies.");
        process.exit(1);
      }
    }

    const engineScript = path.join(RUNTIME_DIR, "src", "cli", "run-engine.ts");

    if (!fs.existsSync(engineScript)) {
      console.error("Error: run-engine.ts not found at", engineScript);
      process.exit(1);
    }

    console.log("Running orchestration pipeline (Node.js engine)...");
    const runProc = spawnTsxNode(engineScript, args, {
      cwd: RUNTIME_DIR,
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

    const runtimeNodeModulesNight = path.join(RUNTIME_DIR, "node_modules");
    if (!fs.existsSync(runtimeNodeModulesNight)) {
      console.log("Installing engine package dependencies (first run)...");
      try {
        execSync("npm install --production=false", {
          cwd: RUNTIME_DIR,
          stdio: "inherit",
        });
      } catch (err) {
        console.error("Failed to install engine package dependencies.");
        process.exit(1);
      }
    }

    const nightScript = path.join(RUNTIME_DIR, "src", "cli", "run-night-worker.ts");

    if (!fs.existsSync(nightScript)) {
      console.error("Error: run-night-worker.ts not found at", nightScript);
      process.exit(1);
    }

    console.log("Starting Night Worker (Node.js)...");
    const nightProc = spawnTsxNode(nightScript, args, {
      cwd: RUNTIME_DIR,
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
    void (async () => {
      const pkg = require(path.join(__dirname, "package.json"));
      const HOST = "127.0.0.1";
      const PORT_LO = 3000;
      const PORT_HI = 3019;

      console.log(`orchestrate v${pkg.version} — Orchestration status\n`);
      console.log("│");
      console.log("◇\n");

      const dashPort = await findListeningDashboardPort(HOST, PORT_LO, PORT_HI, 400);

      if (dashPort != null) {
        console.log(`Dashboard:    http://${HOST}:${dashPort}/`);
        console.log(`              HTTP probe: ok`);
        console.log(`Gateway (WS): ws://${HOST}:${dashPort}/ws/gateway`);
        console.log(`              served by dashboard process (not run-engine)`);
      } else {
        console.log(`Dashboard:    not listening`);
        console.log(`              probed http://${HOST}:${PORT_LO}–${PORT_HI}`);
        console.log(`Gateway (WS): unavailable (dashboard must be running)`);
      }

      const runEnginePids = findRunEnginePids();
      if (runEnginePids.length > 0) {
        const pidLabel = runEnginePids.length > 1 ? "pids" : "pid";
        console.log(`Pipeline:     run-engine running (${pidLabel} ${runEnginePids.join(", ")})`);
      } else {
        console.log(`Pipeline:     run-engine not running`);
      }

      if (dashPort != null) {
        console.log(`\nConnectivity probe: ok`);
      } else {
        console.log(`\nConnectivity probe: dashboard unreachable`);
        console.log(`Troubles:     npm start`);
      }

      const configPath = path.join(ORCH_DIR, "config.json");
      if (!fs.existsSync(configPath)) {
        console.log(`\nProject:      no .orchestration/config.json — run \`orchestrate init\` if needed.`);
        return;
      }

      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const tasksDir = path.join(ORCH_DIR, "tasks");
      const tasks = fs.existsSync(tasksDir)
        ? fs.readdirSync(tasksDir).filter((f) => f.endsWith(".md"))
        : [];

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

      console.log(`\n──────── Project ────────`);
      console.log(`  API Key:    ${config.claudeApiKey ? "configured" : "NOT SET"}`);
      console.log(`  Model:      ${config.model}`);
      console.log(`  Src paths:  ${(config.srcPaths || []).join(", ")}`);
      console.log(`  Parallel:   task=${config.maxParallel?.task ?? "?"}, review=${config.maxParallel?.review ?? "?"}`);
      console.log(`  Tasks:      ${tasks.length} total`);
      if (Object.keys(statusCounts).length > 0) {
        const breakdown = Object.entries(statusCounts)
          .map(([s, n]) => `${s}=${n}`)
          .join(", ");
        console.log(`              ${breakdown}`);
      }
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
    break;
  }

  default: {
    console.error(`Unknown command: '${command}'\n`);
    printHelp();
    process.exit(1);
  }
}
