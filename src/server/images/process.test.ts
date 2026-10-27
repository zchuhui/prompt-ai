import { describe, expect, it } from "vitest";
import { assertStillImage } from "./process";

describe("assertStillImage", () => {
  it("accepts a small static png", () => {
    expect(() =>
      assertStillImage({ format: "png", width: 8, height: 8, pages: 1 }),
    ).not.toThrow();
  });

  it("rejects animation, svg, and images over 40 megapixels", () => {
    expect(() =>
      assertStillImage({ format: "webp", width: 8, height: 8, pages: 2 }),
    ).toThrow(/动画/);
    expect(() => assertStillImage({ format: "svg", width: 8, height: 8 })).toThrow(
      /JPEG/,
    );
    expect(() =>
      assertStillImage({ format: "png", width: 8000, height: 6000 }),
    ).toThrow(/4000 万/);
  });
});
