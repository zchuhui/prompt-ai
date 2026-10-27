import { describe, expect, it } from "vitest";
import { createSlug, isValidSlug, slugifyTitle } from "./slug";

describe("slug", () => {
  it("accepts lowercase words joined by single hyphens", () => {
    expect(isValidSlug("neon-koi-2")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
  });

  it("rejects bad shapes and lengths", () => {
    for (const value of ["ab", "Neon-koi", "neon--koi", "-neon", "neon-", "neon koi", "霓虹", "a".repeat(81)]) {
      expect(isValidSlug(value), value).toBe(false);
    }
  });

  it("slugifies ASCII titles and drops everything else", () => {
    expect(slugifyTitle("  Neon Koi, in RAIN!  ")).toBe("neon-koi-in-rain");
    expect(slugifyTitle("霓虹夜色")).toBe("");
  });

  it("creates valid slugs with a random suffix, falling back to p- for non-ASCII titles", () => {
    expect(createSlug("Neon koi")).toMatch(/^neon-koi-[0-9a-f]{6}$/);
    expect(createSlug("霓虹夜色")).toMatch(/^p-[0-9a-f]{6}$/);
    expect(isValidSlug(createSlug("x".repeat(200)))).toBe(true);
  });
});
