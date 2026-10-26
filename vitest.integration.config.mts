import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import {
  integrationDatabaseUrl,
} from "./src/server/db/database-url";
import { loadLocalEnv } from "./src/server/load-env";

const root = path.dirname(fileURLToPath(import.meta.url));
loadLocalEnv(root);

const configured = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!configured) {
  throw new Error("DATABASE_URL is required for integration tests");
}

const databaseUrl = integrationDatabaseUrl(configured);

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: databaseUrl,
    },
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});
