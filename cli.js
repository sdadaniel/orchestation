#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ORCH_DIR = ".orchestration";
const SCRIPTS_DIR = path.join(__dirname, "scripts");
const FRONTEND_DIR = path.join(__dirname, "src", "frontend");

const command = process.argv[2];
const args = process.argv.slice(3);

function ensureOrchDir() {
  const dirs = [
    ORCH_DIR,
    path.join(ORCH_DIR, "tasks"),
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
      apiKey: "",
      srcPaths: ["src/"],
      model: "claude-sonnet-4-6",
      maxParallel: 3,
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
    console.log("✅ .orchestration/config.json 생성됨");
  }
}

switch (command) {
  case "init": {
    console.log("🚀 Orchestration 초기화...");
    ensureOrchDir();
    ensureConfig();

    // .gitignore에 .orchestration 추가
    const gitignorePath = ".gitignore";
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, "utf-8");
      if (!content.includes(".orchestration")) {
        fs.appendFileSync(gitignorePath, "\n# Orchestration\n.orchestration/\n");
        console.log("✅ .gitignore에 .orchestration/ 추가됨");
      }
    }

    console.log("✅ 초기화 완료!");
    console.log("");
    console.log("다음 단계:");
    console.log("  1. .orchestration/config.json에서 apiKey 설정");
    console.log("  2. orchestrate dashboard  — 대시보드 실행");
    console.log("  3. orchestrate run        — 파이프라인 실행");
    break;
  }

  case "dashboard": {
    console.log("🖥️  대시보드 시작 중...");
    ensureOrchDir();
    const proc = spawn("npm", ["run", "dev"], {
      cwd: FRONTEND_DIR,
      stdio: "inherit",
      env: { ...process.env },
    });
    proc.on("error", (err) => {
      console.error("대시보드 실행 실패:", err.message);
      process.exit(1);
    });
    break;
  }

  case "run": {
    console.log("🚀 파이프라인 실행...");
    ensureOrchDir();
    const proc = spawn("bash", [path.join(SCRIPTS_DIR, "orchestrate.sh"), ...args], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: { ...process.env },
    });
    proc.on("close", (code) => process.exit(code || 0));
    break;
  }

  case "night": {
    console.log("🌙 Night Worker 시작...");
    ensureOrchDir();
    const proc = spawn("bash", [path.join(SCRIPTS_DIR, "night-worker.sh"), ...args], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: { ...process.env },
    });
    proc.on("close", (code) => process.exit(code || 0));
    break;
  }

  case "status": {
    ensureOrchDir();
    const configPath = path.join(ORCH_DIR, "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const tasksDir = path.join(ORCH_DIR, "tasks");
    const tasks = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir).filter((f) => f.endsWith(".md")) : [];

    console.log("📊 Orchestration 상태");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  API Key: ${config.apiKey ? "✅ 설정됨" : "❌ 미설정"}`);
    console.log(`  모델: ${config.model}`);
    console.log(`  소스 경로: ${config.srcPaths.join(", ")}`);
    console.log(`  병렬 실행: ${config.maxParallel}`);
    console.log(`  태스크: ${tasks.length}개`);
    break;
  }

  default: {
    console.log("🎯 Orchestration CLI");
    console.log("");
    console.log("Commands:");
    console.log("  init        프로젝트 초기화 (.orchestration/ 생성)");
    console.log("  dashboard   대시보드 실행 (localhost:3000)");
    console.log("  run         오케스트레이션 파이프라인 실행");
    console.log("  night       Night Worker 시작");
    console.log("  status      현재 상태 확인");
    console.log("");
    console.log("Options (run/night):");
    console.log("  --until HH:MM       종료 시간");
    console.log("  --budget N          예산 한도 (USD)");
    console.log("  --max-tasks N       최대 태스크 수");
    break;
  }
}
