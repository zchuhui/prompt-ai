import { describe, expect, it } from "vitest";
import { publishFieldErrors, type PublishInput } from "./publish";

const ready: PublishInput = {
  title: "荷花",
  promptText: "第一行\n第二行",
  categoryId: "category",
  modelId: "model",
  modelActive: true,
  requireActiveModel: true,
  coverAssetId: "asset",
  images: [{ id: "asset", status: "ready" }],
};

describe("publishFieldErrors", () => {
  it("accepts a complete published prompt", () => {
    expect(publishFieldErrors(ready)).toEqual({});
  });

  it("reports each missing publish requirement", () => {
    expect(
      publishFieldErrors({
        ...ready,
        title: " ",
        promptText: "",
        categoryId: null,
        modelId: "retired",
        modelActive: false,
        coverAssetId: "other",
        images: [{ id: "asset", status: "processing" }],
      }),
    ).toMatchObject({
      title: expect.any(String),
      promptText: expect.any(String),
      categoryId: expect.any(String),
      modelId: expect.any(String),
      coverAssetId: expect.any(String),
      assetItems: expect.any(String),
    });
  });

  it("allows an inactive model when the content is not newly published", () => {
    expect(
      publishFieldErrors({
        ...ready,
        modelActive: false,
        requireActiveModel: false,
      }),
    ).toEqual({});
  });
});
