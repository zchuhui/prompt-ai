import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST as login } from "../../src/app/api/v1/auth/login/route";
import { POST as logout } from "../../src/app/api/v1/auth/logout/route";
import { GET as session } from "../../src/app/api/v1/auth/session/route";
import {
  createInitialAdmin,
  insertSession,
  resetSingleAdminPassword,
} from "../../src/server/auth/repository";
import {
  createSessionToken,
  hashSessionToken,
} from "../../src/server/auth/tokens";
import { closeDatabase, createDatabase, type Database } from "../../src/server/db/client";
import { admins, sessions } from "../../src/server/db/schema";
import { loadLocalEnv } from "../../src/server/load-env";
import { truncateApplicationTables } from "./postgres";

loadLocalEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const origin = process.env.APP_URL ?? "http://localhost:3000";
const password = "correct-horse-battery";

function cookieHeader(response: Response): string {
  const raw = response.headers.get("set-cookie");
  expect(raw).toBeTruthy();
  return raw!.split(";")[0] ?? "";
}

function loginRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`${origin}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-real-ip": "203.0.113.10",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("admin authentication", () => {
  const pool = new Pool({ connectionString });
  let db: Database;

  beforeAll(() => {
    db = createDatabase(pool);
  });

  beforeEach(async () => {
    await truncateApplicationTables(pool);
    await createInitialAdmin(db, { username: "editor", password });
  });

  afterAll(async () => {
    await closeDatabase();
    await pool.end();
  });

  it("stores only the session hash and rejects missing, expired, and logged out sessions", async () => {
    const response = await login(
      loginRequest({ username: "editor", password }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { username: string; csrfToken: string };
    };
    expect(body.data.username).toBe("editor");
    const cookie = cookieHeader(response);
    const token = decodeURIComponent(cookie.split("=")[1] ?? "");
    const [stored] = await db.select().from(sessions);
    expect(stored?.tokenHash).toBe(hashSessionToken(token));
    expect(stored?.tokenHash).not.toBe(token);

    const current = await session(
      new Request(`${origin}/api/v1/auth/session`, {
        headers: { cookie },
      }),
    );
    expect(current.status).toBe(200);

    const [admin] = await db.select().from(admins);
    const expiredToken = createSessionToken();
    await insertSession(db, {
      tokenHash: hashSessionToken(expiredToken),
      adminId: admin!.id,
      expiresAt: new Date(Date.now() - 1000),
    });
    const expired = await session(
      new Request(`${origin}/api/v1/auth/session`, {
        headers: { cookie: `pg-session=${expiredToken}` },
      }),
    );
    expect(expired.status).toBe(401);

    const loggedOut = await logout(
      new Request(`${origin}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          origin,
          cookie,
          "x-csrf-token": body.data.csrfToken,
        },
      }),
    );
    expect(loggedOut.status).toBe(200);
    const after = await session(
      new Request(`${origin}/api/v1/auth/session`, { headers: { cookie } }),
    );
    expect(after.status).toBe(401);
  });

  it("uses one message for unknown users and bad passwords, then limits the address", async () => {
    const unknown = await login(
      loginRequest({ username: "missing", password: "not-the-password" }, {
        "x-real-ip": "203.0.113.20",
      }),
    );
    const wrong = await login(
      loginRequest({ username: "editor", password: "not-the-password" }, {
        "x-real-ip": "203.0.113.21",
      }),
    );
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    const unknownBody = (await unknown.json()) as { error: { message: string } };
    const wrongBody = (await wrong.json()) as { error: { message: string } };
    expect(unknownBody.error.message).toBe(wrongBody.error.message);
    expect(unknownBody.error.message).not.toMatch(/不存在/);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await login(
        loginRequest({ username: "editor", password: "still-wrong" }, {
          "x-real-ip": "203.0.113.30",
        }),
      );
      expect(failed.status).toBe(401);
    }
    const limited = await login(
      loginRequest({ username: "editor", password }, {
        "x-real-ip": "203.0.113.30",
      }),
    );
    expect(limited.status).toBe(429);
  });

  it("rejects cross-origin changes and unauthenticated writes", async () => {
    const crossOrigin = await login(
      loginRequest(
        { username: "editor", password },
        { origin: "https://evil.example" },
      ),
    );
    expect(crossOrigin.status).toBe(403);

    const unauthenticated = await logout(
      new Request(`${origin}/api/v1/auth/logout`, {
        method: "POST",
        headers: { origin },
      }),
    );
    expect(unauthenticated.status).toBe(401);

    const signedIn = await login(loginRequest({ username: "editor", password }));
    const cookie = cookieHeader(signedIn);
    const missingCsrf = await logout(
      new Request(`${origin}/api/v1/auth/logout`, {
        method: "POST",
        headers: { origin, cookie },
      }),
    );
    expect(missingCsrf.status).toBe(403);
  });

  it("resets the only administrator and deletes sessions", async () => {
    await login(loginRequest({ username: "editor", password }));
    await resetSingleAdminPassword(db, "replacement-password");
    const remaining = await db.select().from(sessions);
    expect(remaining).toHaveLength(0);
    await expect(
      createInitialAdmin(db, { username: "other", password: "another-password" }),
    ).rejects.toThrow(/已存在/);
    const again = await login(
      loginRequest({ username: "editor", password: "replacement-password" }),
    );
    expect(again.status).toBe(200);
  });
});
