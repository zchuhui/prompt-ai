import { describe, expect, it } from "vitest";
import { escapeLike } from "./search";

describe("escapeLike", () => {
  it("escapes wildcard characters without changing the rest of the text", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
    expect(escapeLike("荷花")).toBe("荷花");
  });
});
