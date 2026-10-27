import "server-only";

import { AppError } from "@/shared/errors";
import { LOGIN_FAILURE_LIMIT, LOGIN_WINDOW_MS, SESSION_TTL_MS } from "@/shared/constants";
import type { Database } from "@/server/db/client";
import { passwordMatches } from "@/server/auth/password";
import {
  deleteSession,
  findActiveSession,
  findAdminByUsername,
  insertSession,
  readRateCount,
  recordRateHit,
  writeAudit,
} from "@/server/auth/repository";
import {
  createCsrfToken,
  createSessionToken,
  hashSessionToken,
  loginRateLimitKey,
  windowStart,
} from "@/server/auth/tokens";

const invalidCredentials = new AppError(
  401,
  "UNAUTHORIZED",
  "用户名或密码不正确",
);

const rateLimited = new AppError(429, "RATE_LIMITED", "尝试次数过多，请稍后再试");

export type AdminContext = {
  adminId: string;
  username: string;
  token: string;
  csrfToken: string;
};

export async function loginAdmin(
  db: Database,
  input: {
    username: string;
    password: string;
    ip: string;
    rateLimitSecret: string;
    csrfSecret: string;
    requestId: string;
    now?: Date;
  },
): Promise<AdminContext> {
  const now = input.now ?? new Date();
  const key = loginRateLimitKey(
    input.rateLimitSecret,
    input.ip,
    input.username,
  );
  const start = windowStart(now, LOGIN_WINDOW_MS);
  if ((await readRateCount(db, key, start)) >= LOGIN_FAILURE_LIMIT) {
    throw rateLimited;
  }

  const admin = await findAdminByUsername(db, input.username);
  const matches = await passwordMatches(admin?.passwordHash, input.password);
  if (!admin || !matches) {
    await recordRateHit(db, key, start);
    throw invalidCredentials;
  }

  const token = createSessionToken();
  await insertSession(db, {
    tokenHash: hashSessionToken(token),
    adminId: admin.id,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  await writeAudit(db, {
    adminId: admin.id,
    action: "auth.login",
    entityType: "admin",
    entityId: admin.id,
    requestId: input.requestId,
  });

  return {
    adminId: admin.id,
    username: admin.username,
    token,
    csrfToken: createCsrfToken(token, input.csrfSecret),
  };
}

export async function logoutAdmin(
  db: Database,
  input: { token: string; requestId: string },
): Promise<void> {
  const tokenHash = hashSessionToken(input.token);
  const session = await findActiveSession(db, tokenHash, new Date());
  await deleteSession(db, tokenHash);
  if (session) {
    await writeAudit(db, {
      adminId: session.adminId,
      action: "auth.logout",
      entityType: "admin",
      entityId: session.adminId,
      requestId: input.requestId,
    });
  }
}

export async function readAdminContext(
  db: Database,
  token: string | undefined,
  csrfSecret: string,
  now = new Date(),
): Promise<AdminContext | null> {
  if (!token) {
    return null;
  }
  const session = await findActiveSession(db, hashSessionToken(token), now);
  if (!session) {
    return null;
  }
  return {
    adminId: session.adminId,
    username: session.username,
    token,
    csrfToken: createCsrfToken(token, csrfSecret),
  };
}
