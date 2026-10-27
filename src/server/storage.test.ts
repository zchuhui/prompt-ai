import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseEnv } from "./env-core";
import { FileStorage, type ObjectStorage } from "./storage";

const base = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://prompt:local-only@localhost:5432/prompt_gallery",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "prompt-gallery",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
  S3_FORCE_PATH_STYLE: "true",
  CSRF_SECRET: "csrf",
  RATE_LIMIT_SECRET: "rate",
  LOG_LEVEL: "info",
  WORKER_CONCURRENCY: "2",
};

describe("file storage", () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("is refused in production", () => {
    expect(parseEnv({ ...base, STORAGE_DRIVER: "fs", NODE_ENV: "development" }).STORAGE_DRIVER).toBe("fs");
    expect(() => parseEnv({ ...base, STORAGE_DRIVER: "fs", NODE_ENV: "production" })).toThrow(
      /STORAGE_DRIVER/,
    );
  });

  it("stores, lists and deletes objects under its root only", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "pg-storage-"));
    const storage: ObjectStorage = new FileStorage(root);
    await storage.put("public/a/v1/card.webp", new Uint8Array([1, 2]), "image/webp");
    expect([...(await storage.get("public/a/v1/card.webp"))]).toEqual([1, 2]);
    expect((await storage.list("public/")).map((item) => item.key)).toEqual(["public/a/v1/card.webp"]);
    await storage.delete("public/a/v1/card.webp");
    await expect(storage.get("public/a/v1/card.webp")).rejects.toMatchObject({ status: 404 });
    await expect(storage.put("../escape", new Uint8Array([1]), "x")).rejects.toMatchObject({
      status: 400,
    });
  });
});
