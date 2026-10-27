import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { AppError } from "@/shared/errors";
import {
  EVENT_BODY_MAX_BYTES,
  EVENT_RATE_LIMIT,
  EVENT_WINDOW_MS,
} from "@/shared/constants";
import type { Database } from "@/server/db/client";
import { analyticsEvents, prompts, rateLimits } from "@/server/db/schema";
import { sha256 } from "@/server/body";
import { windowStart } from "@/server/auth/tokens";

const kinds = new Set([
  "page_view",
  "detail_view",
  "prompt_copy",
  "search",
  "search_empty",
]);

export async function recordEvent(
  db: Database,
  input: {
    rawBody: string;
    ip: string;
    secret: string;
    body: {
      eventId?: unknown;
      kind?: unknown;
      promptId?: unknown;
      path?: unknown;
      query?: unknown;
    };
  },
) {
  if (new TextEncoder().encode(input.rawBody).byteLength > EVENT_BODY_MAX_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "事件过大");
  }
  const eventId = typeof input.body.eventId === "string" ? input.body.eventId : "";
  const kind = typeof input.body.kind === "string" ? input.body.kind : "";
  const path = typeof input.body.path === "string" ? input.body.path : "";
  const query = typeof input.body.query === "string" ? input.body.query : null;
  const promptId = typeof input.body.promptId === "string" ? input.body.promptId : null;
  if (!kinds.has(kind) || eventId.length < 8 || eventId.length > 80 || path.length < 1 || path.length > 2048) {
    throw new AppError(400, "INVALID_INPUT", "事件不合法");
  }
  if (query && query.length > 100) {
    throw new AppError(400, "INVALID_INPUT", "事件不合法");
  }
  if ((kind === "detail_view" || kind === "prompt_copy") && !promptId) {
    throw new AppError(400, "INVALID_INPUT", "事件不合法");
  }
  const keyHash = sha256(`${input.secret}\0event\0${input.ip}`);
  const start = windowStart(new Date(), EVENT_WINDOW_MS);
  const [current] = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(and(eq(rateLimits.keyHash, keyHash), eq(rateLimits.windowStart, start)))
    .limit(1);
  if ((current?.count ?? 0) >= EVENT_RATE_LIMIT) {
    throw new AppError(429, "RATE_LIMITED", "请求过于频繁");
  }
  await db
    .insert(rateLimits)
    .values({ keyHash, windowStart: start, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.keyHash, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    });
  if (promptId) {
    const [prompt] = await db
      .select({ id: prompts.id })
      .from(prompts)
      .where(
        and(eq(prompts.id, promptId), eq(prompts.status, "published"), sql`${prompts.deletedAt} is null`),
      )
      .limit(1);
    if (!prompt) {
      throw new AppError(404, "NOT_FOUND", "内容不存在");
    }
  }
  await db
    .insert(analyticsEvents)
    .values({
      eventId,
      kind: kind as "page_view" | "detail_view" | "prompt_copy" | "search" | "search_empty",
      promptId,
      path,
      queryText: query,
    })
    .onConflictDoNothing({ target: analyticsEvents.eventId });
}
