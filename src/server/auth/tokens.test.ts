import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  createCsrfToken,
  csrfTokensMatch,
  hashSessionToken,
  originsMatch,
  serializeSessionCookie,
  sessionCookieConfig,
} from "./tokens";

describe("session cookies", () => {
  it("uses a host-only secure cookie in production", () => {
    const config = sessionCookieConfig({
      nodeEnv: "production",
      appUrl: "http://localhost:3000",
    });

    expect(config).toMatchObject({
      name: "__Host-pg-session",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    expect(serializeSessionCookie("token", config)).toContain("Secure");
    expect(serializeSessionCookie("token", config)).not.toContain("Domain=");
  });

  it("uses the development cookie on local http", () => {
    const config = sessionCookieConfig({
      nodeEnv: "test",
      appUrl: "http://localhost:3000",
    });

    expect(config.name).toBe("pg-session");
    expect(config.secure).toBe(false);
    expect(clearSessionCookie(config)).toContain("Max-Age=0");
  });
});

describe("csrf and origin", () => {
  it("accepts only the hmac derived from the session token", () => {
    const token = "session-token";
    const expected = createCsrfToken(token, "secret");

    expect(csrfTokensMatch(expected, expected)).toBe(true);
    expect(csrfTokensMatch(expected, createCsrfToken(token, "other"))).toBe(
      false,
    );
    expect(csrfTokensMatch(expected, "")).toBe(false);
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it("requires the application origin exactly", () => {
    expect(originsMatch("http://localhost:3000", "http://localhost:3000")).toBe(
      true,
    );
    expect(
      originsMatch("https://evil.example", "http://localhost:3000"),
    ).toBe(false);
    expect(originsMatch(null, "http://localhost:3000")).toBe(false);
  });
});
