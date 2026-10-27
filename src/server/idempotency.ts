import { and, eq } from "drizzle-orm";
import { AppError } from "@/shared/errors";
import { IDEMPOTENCY_TTL_MS } from "@/shared/constants";
import type { Database } from "@/server/db/client";
import { idempotencyKeys } from "@/server/db/schema";
import { sha256 } from "./body";

export function requestHash(pathname: string, rawBody: string): string {
  return sha256(`${pathname}\0${rawBody}`);
}

export async function withIdempotency<T extends Record<string, unknown>>(
  db: Database,
  input: {
    adminId: string;
    key: string | null;
    hash: string;
    now?: Date;
  },
  run: () => Promise<T>,
): Promise<T> {
  if (!input.key) {
    return run();
  }
  if (input.key.length < 8 || input.key.length > 200) {
    throw new AppError(400, "INVALID_INPUT", "Idempotency-Key 无效");
  }
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_MS);
  const inserted = await db
    .insert(idempotencyKeys)
    .values({
      adminId: input.adminId,
      key: input.key,
      requestHash: input.hash,
      response: null,
      expiresAt,
    })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });

  if (inserted.length === 0) {
    const [existing] = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.adminId, input.adminId),
          eq(idempotencyKeys.key, input.key),
        ),
      )
      .limit(1);
    if (!existing || existing.requestHash !== input.hash) {
      throw new AppError(409, "IDEMPOTENCY_CONFLICT", "幂等键与请求内容不一致");
    }
    if (existing.expiresAt.getTime() <= now.getTime()) {
      await db
        .delete(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.adminId, input.adminId),
            eq(idempotencyKeys.key, input.key),
          ),
        );
      return withIdempotency(db, input, run);
    }
    if (!existing.response) {
      throw new AppError(409, "IDEMPOTENCY_CONFLICT", "相同请求正在处理");
    }
    return existing.response as T;
  }

  try {
    const result = await run();
    await db
      .update(idempotencyKeys)
      .set({ response: result })
      .where(
        and(
          eq(idempotencyKeys.adminId, input.adminId),
          eq(idempotencyKeys.key, input.key),
        ),
      );
    return result;
  } catch (error) {
    await db
      .delete(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.adminId, input.adminId),
          eq(idempotencyKeys.key, input.key),
        ),
      );
    throw error;
  }
}
