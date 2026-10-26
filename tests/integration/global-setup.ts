import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectionDatabaseName,
  integrationDatabaseUrl,
  withDatabase,
} from "../../src/server/db/database-url";
import { loadLocalEnv } from "../../src/server/load-env";
import { migrateDatabase, recreateDatabase } from "./postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function setup(): Promise<void> {
  loadLocalEnv(root);
  const configured = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!configured) {
    throw new Error("DATABASE_URL is required for integration tests");
  }

  const databaseUrl = integrationDatabaseUrl(configured);
  await recreateDatabase(
    withDatabase(databaseUrl, "postgres"),
    connectionDatabaseName(databaseUrl),
  );
  await migrateDatabase(databaseUrl, path.join(root, "drizzle"));
}
