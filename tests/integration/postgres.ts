import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { expect } from "vitest";
import { assertSafeDatabaseName } from "../../src/server/db/database-url";

export const applicationTables = [
  "audit_logs",
  "analytics_events",
  "rate_limits",
  "idempotency_keys",
  "jobs",
  "upload_items",
  "upload_batches",
  "collection_prompts",
  "collections",
  "prompt_assets",
  "prompt_tags",
  "prompts",
  "assets",
  "models",
  "tags",
  "categories",
  "sessions",
  "admins",
] as const;

export async function recreateDatabase(
  adminUrl: string,
  database: string,
): Promise<void> {
  assertSafeDatabaseName(database);
  const pool = new Pool({ connectionString: adminUrl });
  try {
    await pool.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
      [database],
    );
    await pool.query(`drop database if exists "${database}"`);
    await pool.query(`create database "${database}"`);
  } finally {
    await pool.end();
  }
}

export async function migrateDatabase(
  connectionString: string,
  migrationsFolder: string,
): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

export async function truncateApplicationTables(pool: Pool): Promise<void> {
  await pool.query(
    `truncate table ${applicationTables.join(", ")} restart identity cascade`,
  );
}

export function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const record = error as { code?: unknown; cause?: unknown };
  if (typeof record.code === "string") {
    return record.code;
  }
  return sqlState(record.cause);
}

export async function expectSqlState(
  run: () => Promise<unknown>,
  state: string,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(sqlState(error)).toBe(state);
    return;
  }
  expect.fail(`Expected SQLSTATE ${state}`);
}
