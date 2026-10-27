import { describe, expect, it } from "vitest";
import { formatDateTime, formatPercent } from "./format";

describe("format", () => {
  it("formats in Asia/Shanghai regardless of host time zone", () => {
    expect(formatDateTime("2026-10-27T03:41:00.000Z")).toBe("2026-10-27 11:41");
    expect(formatDateTime("2026-12-31T16:05:00.000Z")).toBe("2027-01-01 00:05");
  });

  it("formats rates", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(0.1234)).toBe("12.3%");
  });
});
