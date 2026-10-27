import { describe, expect, it } from "vitest";
import { moveItem } from "@/shared/array";
import { mergeServerAssets, toPatch, type EditorAsset, type EditorPrompt } from "./editor-state";

const asset = (assetId: string, status = "ready", alt: string | null = null): EditorAsset => ({
  assetId,
  position: 0,
  alt,
  status,
  width: 10,
  height: 10,
});

const base: EditorPrompt = {
  id: "p",
  slug: "p-abc123",
  title: "t",
  summary: null,
  promptText: "x",
  negativePrompt: null,
  usageNotes: null,
  parametersText: null,
  modelVersion: null,
  aspectRatio: null,
  requiresReference: false,
  sourceType: "original",
  sourceAuthor: null,
  sourceUrl: null,
  categoryId: null,
  modelId: null,
  status: "draft",
  coverAssetId: null,
  version: 3,
  publishedAt: null,
  updatedAt: "2026-10-27T00:00:00.000Z",
  tagIds: [],
  assetItems: [],
};

describe("mergeServerAssets", () => {
  it("keeps local order, alt and edits while appending new server images", () => {
    const local = { ...base, title: "unsaved", assetItems: [asset("b", "ready", "B alt"), asset("a")] };
    const server = {
      ...base,
      coverAssetId: "a",
      assetItems: [asset("a"), asset("b", "ready", "old"), asset("c", "processing")],
    };
    const merged = mergeServerAssets(local, server, new Set());
    expect(merged.title).toBe("unsaved");
    expect(merged.assetItems.map((item) => item.assetId)).toEqual(["b", "a", "c"]);
    expect(merged.assetItems[0]?.alt).toBe("B alt");
    expect(merged.coverAssetId).toBe("a");
  });

  it("does not resurrect images removed locally and refreshes statuses", () => {
    const local = { ...base, coverAssetId: "a", assetItems: [asset("a", "processing")] };
    const server = { ...base, assetItems: [asset("a"), asset("gone")] };
    const merged = mergeServerAssets(local, server, new Set(["gone"]));
    expect(merged.assetItems.map((item) => [item.assetId, item.status])).toEqual([["a", "ready"]]);
    expect(merged.coverAssetId).toBe("a");
  });
});

describe("editor helpers", () => {
  it("moves items within bounds", () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 2, 5)).toEqual([1, 2, 3]);
  });

  it("builds a patch with positions, trimmed alt and optional slug", () => {
    const patch = toPatch(
      { ...base, sourceUrl: "  ", assetItems: [asset("b", "ready", "  "), asset("a", "ready", " A ")] },
      false,
    );
    expect(patch).not.toHaveProperty("slug");
    expect(patch.sourceUrl).toBeNull();
    expect(patch.assetItems).toEqual([
      { assetId: "b", position: 0, alt: null },
      { assetId: "a", position: 1, alt: "A" },
    ]);
    expect(toPatch(base, true).slug).toBe("p-abc123");
  });
});
