/**
 * 게이트웨이+Next 공식 dev 엔트리(`npm run dev`)를 PORT / PROJECT_ROOT / PACKAGE_DIR와 함께 실행한다.
 * worktree·에이전트가 `npx next dev`로 빠지지 않도록 기본 env를 리포 루트에 맞춘다.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(dashboardRoot, "..", "..");

const portArg = process.argv[2];
const port =
  portArg && /^\d+$/.test(portArg)
    ? portArg
    : process.env.PORT && /^\d+$/.test(process.env.PORT)
      ? process.env.PORT
      : "3001";

const env = {
  ...process.env,
  PORT: String(port),
  PROJECT_ROOT: process.env.PROJECT_ROOT || repoRoot,
  PACKAGE_DIR: process.env.PACKAGE_DIR || repoRoot,
};

const child = spawn("npm", ["run", "dev"], {
  cwd: dashboardRoot,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
