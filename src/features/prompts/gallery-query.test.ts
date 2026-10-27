import { describe, expect, it } from "vitest";
import {
  galleryHref,
  galleryQuery,
  isFiltered,
  parseGalleryParams,
  toggleTag,
  withParams,
} from "./gallery-query";

describe("gallery query", () => {
  it("parses, trims, de-duplicates and sorts tags", () => {
    const params = parseGalleryParams({ q: "  荷花 ", tags: "3d, healing,3d,,", model: ["flux", "x"] });
    expect(params).toEqual({ q: "荷花", category: "", model: "flux", tags: ["3d", "healing"] });
    expect(isFiltered(params)).toBe(true);
    expect(isFiltered(parseGalleryParams({}))).toBe(false);
  });

  it("keeps selected tags when other filters change", () => {
    const params = parseGalleryParams({ tags: "healing,3d", category: "landscape" });
    const next = withParams(params, { model: "flux", q: "龙" });
    expect(galleryQuery(next)).toBe("q=%E9%BE%99&category=landscape&model=flux&tags=3d%2Chealing");
  });

  it("toggles tags and only writes the page after the first", () => {
    const params = parseGalleryParams({ tags: "3d" });
    expect(toggleTag(params, "healing").tags).toEqual(["3d", "healing"]);
    expect(toggleTag(params, "3d").tags).toEqual([]);
    expect(galleryHref(params, 1)).toBe("/?tags=3d");
    expect(galleryHref(params, 3)).toBe("/?tags=3d&page=3");
    expect(galleryHref(parseGalleryParams({}))).toBe("/");
  });
});
