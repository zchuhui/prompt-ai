import "server-only";

import { cookies } from "next/headers";
import { AppError } from "@/shared/errors";
import {
  clearSessionCookie,
  clientIp,
  createCsrfToken,
  csrfTokensMatch,
  originsMatch,
  readCookie,
  serializeSessionCookie,
  sessionCookieConfig,
  type SessionCookieConfig,
} from "@/server/auth/tokens";
import { getDatabase } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { readAdminContext, type AdminContext } from "./service";

export function currentCookieConfig(): SessionCookieConfig {
  return sessionCookieConfig({
    nodeEnv: process.env.NODE_ENV,
    appUrl: getEnv().APP_URL,
  });
}

export function assertSameOrigin(request: Request): void {
  if (!originsMatch(request.headers.get("origin"), getEnv().APP_URL)) {
    throw new AppError(403, "FORBIDDEN", "跨源请求被拒绝");
  }
}

export function assertCsrf(request: Request, sessionToken: string): void {
  const provided = request.headers.get("x-csrf-token") ?? "";
  const expected = createCsrfToken(sessionToken, getEnv().CSRF_SECRET);
  if (!csrfTokensMatch(expected, provided)) {
    throw new AppError(403, "FORBIDDEN", "CSRF 校验失败");
  }
}

export function sessionTokenFromRequest(request: Request): string | undefined {
  return readCookie(request.headers.get("cookie"), currentCookieConfig().name);
}

export async function readRequestAdmin(
  request: Request,
): Promise<AdminContext | null> {
  return readAdminContext(
    getDatabase(),
    sessionTokenFromRequest(request),
    getEnv().CSRF_SECRET,
  );
}

export async function requireAdmin(request: Request): Promise<AdminContext> {
  const admin = await readRequestAdmin(request);
  if (!admin) {
    throw new AppError(401, "UNAUTHORIZED", "需要登录");
  }
  return admin;
}

export async function requireAdminMutation(
  request: Request,
): Promise<AdminContext> {
  assertSameOrigin(request);
  const admin = await requireAdmin(request);
  assertCsrf(request, admin.token);
  return admin;
}

export function withSessionCookie(response: Response, token: string): Response {
  response.headers.append(
    "set-cookie",
    serializeSessionCookie(token, currentCookieConfig()),
  );
  return response;
}

export function withClearedSession(response: Response): Response {
  response.headers.append(
    "set-cookie",
    clearSessionCookie(currentCookieConfig()),
  );
  return response;
}

export function requestClientIp(request: Request): string {
  return clientIp(request);
}

export async function readPageAdmin(): Promise<AdminContext | null> {
  const jar = await cookies();
  const token = jar.get(currentCookieConfig().name)?.value;
  return readAdminContext(getDatabase(), token, getEnv().CSRF_SECRET);
}
