import { writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/workers/index.ts"],
  format: ["esm"],
  outDir: "dist/worker",
  target: "node24",
  platform: "node",
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["sharp", "pg"],
  outExtension: () => ({ js: ".js" }),
  esbuildOptions(options) {
    options.alias = {
      "@": path.resolve("src"),
    };
  },
  async onSuccess() {
    writeFileSync(
      path.join("dist/worker", "package.json"),
      `${JSON.stringify({ type: "module" }, null, 2)}\n`,
    );
  },
});
