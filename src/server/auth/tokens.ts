import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { SESSION_TTL_MS } from "@/shared/constants";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createCsrfToken(sessionToken: string, secret: string): string {
  return createHmac("sha256", secret).update(sessionToken).digest("base64url");
}

export function csrfTokensMatch(expected: string, provided: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length || left.length === 0) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function loginRateLimitKey(
  secret: string,
  ip: string,
  username: string,
): string {
  return createHash("sha256")
    .update(`${secret}\0login\0${ip}\0${username.toLowerCase()}`)
    .digest("hex");
}

export function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export type SessionCookieConfig = {
  name: string;
  secure: boolean;
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export function sessionCookieConfig(input: {
  nodeEnv: string | undefined;
  appUrl: string;
}): SessionCookieConfig {
  const https = new URL(input.appUrl).protocol === "https:";
  const secure = input.nodeEnv === "production" || https;
  return {
    name: secure ? "__Host-pg-session" : "pg-session",
    secure,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export function readCookie(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export function serializeSessionCookie(
  token: string,
  config: SessionCookieConfig,
): string {
  const parts = [
    `${config.name}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${config.maxAge}`,
  ];
  if (config.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearSessionCookie(config: SessionCookieConfig): string {
  const parts = [
    `${config.name}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];
  if (config.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function originsMatch(
  originHeader: string | null,
  appUrl: string,
): boolean {
  if (!originHeader) {
    return false;
  }
  try {
    return new URL(originHeader).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

export function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && realIp.length > 0 && !realIp.includes(",")) {
    return realIp;
  }
  return "direct";
}
