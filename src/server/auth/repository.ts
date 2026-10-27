import { and, eq, gt, sql } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { admins, auditLogs, rateLimits, sessions } from "@/server/db/schema";
import { assertPasswordPolicy, assertUsername, hashPassword } from "./password";

export async function countAdmins(db: Database): Promise<number> {
  const [row] = await db.select({ value: sql<number>`count(*)::int` }).from(admins);
  return Number(row?.value ?? 0);
}

export async function findAdminByUsername(db: Database, username: string) {
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.username, username))
    .limit(1);
  return admin ?? null;
}

export async function insertSession(
  db: Database,
  input: { tokenHash: string; adminId: string; expiresAt: Date },
): Promise<void> {
  await db.insert(sessions).values(input);
}

export async function deleteSession(db: Database, tokenHash: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function findActiveSession(
  db: Database,
  tokenHash: string,
  now: Date,
) {
  const [session] = await db
    .select({
      adminId: admins.id,
      username: admins.username,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(admins, eq(admins.id, sessions.adminId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);
  return session ?? null;
}

export async function readRateCount(
  db: Database,
  keyHash: string,
  windowStart: Date,
): Promise<number> {
  const [row] = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(
      and(eq(rateLimits.keyHash, keyHash), eq(rateLimits.windowStart, windowStart)),
    )
    .limit(1);
  return row?.count ?? 0;
}

export async function recordRateHit(
  db: Database,
  keyHash: string,
  windowStart: Date,
): Promise<void> {
  await db
    .insert(rateLimits)
    .values({ keyHash, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.keyHash, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    });
}

export async function writeAudit(
  db: Database,
  input: {
    adminId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    requestId: string;
  },
): Promise<void> {
  await db.insert(auditLogs).values({
    adminId: input.adminId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    requestId: input.requestId,
  });
}

export async function createInitialAdmin(
  db: Database,
  input: { username: string; password: string },
): Promise<void> {
  const username = assertUsername(input.username);
  assertPasswordPolicy(input.password);
  if ((await countAdmins(db)) > 0) {
    throw new Error("管理员已存在");
  }
  const passwordHash = await hashPassword(input.password);
  await db.insert(admins).values({ username, passwordHash });
}

export async function resetSingleAdminPassword(
  db: Database,
  password: string,
): Promise<void> {
  assertPasswordPolicy(password);
  const rows = await db.select({ id: admins.id }).from(admins);
  const admin = rows[0];
  if (!admin || rows.length !== 1) {
    throw new Error("需要恰好一名管理员才能重置密码");
  }
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(admins).set({ passwordHash }).where(eq(admins.id, admin.id));
    await tx.delete(sessions);
    await tx.insert(auditLogs).values({
      adminId: admin.id,
      action: "auth.password_reset",
      entityType: "admin",
      entityId: admin.id,
      requestId: "cli",
    });
  });
}
