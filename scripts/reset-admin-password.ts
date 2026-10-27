import { resetSingleAdminPassword } from "../src/server/auth/repository";
import { createDatabase, createPool } from "../src/server/db/client";
import { loadLocalEnv } from "../src/server/load-env";
import { promptHidden, rejectArguments } from "./prompt";

async function main(): Promise<void> {
  rejectArguments();
  loadLocalEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const password = await promptHidden("新密码: ");
  const confirmation = await promptHidden("再次输入新密码: ");
  if (password !== confirmation) {
    throw new Error("两次输入的密码不一致");
  }

  const pool = createPool(connectionString);
  try {
    await resetSingleAdminPassword(createDatabase(pool), password);
  } finally {
    await pool.end();
  }
  console.log("密码已重置，全部会话已退出");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
