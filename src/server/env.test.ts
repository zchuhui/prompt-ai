import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseEnv } from "./env";

const validEnv = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://prompt:local-only@localhost:5432/prompt_gallery",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "prompt-gallery",
  S3_ACCESS_KEY_ID: "replace-local-key",
  S3_SECRET_ACCESS_KEY: "replace-local-secret",
  S3_FORCE_PATH_STYLE: "true",
  CSRF_SECRET: "replace-with-random-secret",
  RATE_LIMIT_SECRET: "replace-with-random-secret",
  LOG_LEVEL: "info",
  WORKER_CONCURRENCY: "2",
};

describe("parseEnv", () => {
  it("accepts the local example and coerces typed fields", () => {
    const env = parseEnv(validEnv);

    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.WORKER_CONCURRENCY).toBe(2);
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("rejects an invalid application URL", () => {
    expect(() => parseEnv({ ...validEnv, APP_URL: "localhost" })).toThrow(
      /APP_URL/,
    );
  });

  it("rejects an empty secret", () => {
    expect(() => parseEnv({ ...validEnv, CSRF_SECRET: "" })).toThrow(
      /CSRF_SECRET/,
    );
  });
});
