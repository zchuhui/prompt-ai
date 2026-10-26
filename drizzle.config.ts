import { defineConfig } from "drizzle-kit";
import { loadLocalEnv } from "./src/server/load-env";

loadLocalEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is required. Copy .env.example to .env.local.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
