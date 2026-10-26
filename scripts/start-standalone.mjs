import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next", "standalone");

if (!existsSync(join(standalone, "server.js"))) {
  console.error("Missing .next/standalone/server.js. Run pnpm build first.");
  process.exit(1);
}

const publicDir = join(root, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, join(standalone, "public"), { recursive: true });
}

cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), {
  recursive: true,
});

const child = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
