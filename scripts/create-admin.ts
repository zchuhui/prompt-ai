import { createDatabase, createPool } from "../src/server/db/client";
import { createInitialAdmin } from "../src/server/auth/repository";
import { loadLocalEnv } from "../src/server/load-env";
import { promptHidden, promptLine, rejectArguments } from "./prompt";

async function main(): Promise<void> {
  rejectArguments();
  loadLocalEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const username = await promptLine("用户名: ");
  const password = await promptHidden("密码: ");
  const confirmation = await promptHidden("再次输入密码: ");
  if (password !== confirmation) {
    throw new Error("两次输入的密码不一致");
  }

  const pool = createPool(connectionString);
  try {
    await createInitialAdmin(createDatabase(pool), { username, password });
  } finally {
    await pool.end();
  }
  console.log("管理员已创建");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
