import "server-only";

import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const envSchema = z.object({
  APP_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanFromString,
  CSRF_SECRET: z.string().min(1),
  RATE_LIMIT_SECRET: z.string().min(1),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  WORKER_CONCURRENCY: z.coerce.number().int().positive(),
});

export type Env = z.infer<typeof envSchema>;

function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return `${path || "env"}: ${issue.message}`;
    })
    .join("\n");
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${formatEnvError(parsed.error)}`);
  }
  return parsed.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
