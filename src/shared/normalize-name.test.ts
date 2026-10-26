import { describe, expect, it } from "vitest";
import { normalizeName } from "./normalize-name";

describe("normalizeName", () => {
  it("trims, lowercases, and applies NFKC", () => {
    expect(normalizeName("  GPT Image  ")).toBe("gpt image");
    expect(normalizeName("Ａ")).toBe("a");
    expect(normalizeName("３D")).toBe("3d");
  });

  it("keeps internal spaces", () => {
    expect(normalizeName("东方 神话")).toBe("东方 神话");
  });
});
