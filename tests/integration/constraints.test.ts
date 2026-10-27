import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "../../src/server/db/client";
import {
  assets,
  categories,
  promptAssets,
  promptTags,
  prompts,
  tags,
} from "../../src/server/db/schema";
import { expectSqlState, truncateApplicationTables } from "./postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

describe("database constraints", () => {
  const pool = new Pool({ connectionString });
  let db: Database;

  beforeAll(() => {
    db = createDatabase(pool);
  });

  beforeEach(async () => {
    await truncateApplicationTables(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("rejects duplicate names, empty published rows, and oversized text", async () => {
    await db.insert(categories).values({
      name: "植物",
      normalizedName: "植物",
      slug: "plant-a",
      sortOrder: 0,
    });
    await expectSqlState(
      () =>
        db.insert(categories).values({
          name: "植物",
          normalizedName: "植物",
          slug: "plant-b",
          sortOrder: 1,
        }),
      "23505",
    );
    await expectSqlState(
      () =>
        db.insert(categories).values({
          name: "ABC",
          normalizedName: "ABC",
          slug: "abc-upper",
          sortOrder: 0,
        }),
      "23514",
    );

    await db.insert(prompts).values({ slug: "empty-draft", title: "" });
    await expectSqlState(
      () => db.insert(prompts).values({ slug: "empty-draft" }),
      "23505",
    );
    await expectSqlState(
      () =>
        db.insert(prompts).values({
          slug: "long-title",
          title: "a".repeat(121),
        }),
      "23514",
    );
    await expectSqlState(
      () => db.insert(prompts).values({ slug: "published-without-time", status: "published" }),
      "23514",
    );
    await db.insert(prompts).values({
      slug: "published-with-time",
      status: "published",
      publishedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    await expectSqlState(
      () =>
        db.insert(prompts).values({
          slug: "bad-url",
          sourceUrl: "javascript:alert(1)",
        }),
      "23514",
    );
    await db.insert(prompts).values({
      slug: "good-url",
      sourceUrl: "https://example.com/source",
    });
    await expectSqlState(
      () => db.insert(prompts).values({ slug: "bad-version", version: 0 }),
      "23514",
    );
  });

  it("protects referenced categories and shared assets, and cascades tag links", async () => {
    const [category] = await db
      .insert(categories)
      .values({
        name: "风景",
        normalizedName: "风景",
        slug: "landscape",
        sortOrder: 0,
      })
      .returning();
    const [prompt] = await db
      .insert(prompts)
      .values({ slug: "landscape-draft", categoryId: category?.id })
      .returning();
    if (!category || !prompt) {
      throw new Error("missing fixture");
    }

    await expectSqlState(
      () => db.delete(categories).where(eq(categories.id, category.id)),
      "23503",
    );

    const [tag] = await db
      .insert(tags)
      .values({ name: "临时", normalizedName: "临时", slug: "temp" })
      .returning();
    if (!tag) {
      throw new Error("missing tag");
    }
    await db.insert(promptTags).values({ promptId: prompt.id, tagId: tag.id });
    await db.delete(tags).where(eq(tags.id, tag.id));
    expect(await db.select().from(promptTags)).toHaveLength(0);
    expect(
      await db.select().from(prompts).where(eq(prompts.id, prompt.id)),
    ).toHaveLength(1);

    const [firstAsset] = await db
      .insert(assets)
      .values({
        sourceKey: "shared-a-source",
        originalKey: "shared-a",
        status: "ready",
        width: 8000,
        height: 5000,
      })
      .returning();
    const [secondAsset] = await db
      .insert(assets)
      .values({ sourceKey: "shared-b-source", originalKey: "shared-b", status: "ready" })
      .returning();
    const [otherPrompt] = await db
      .insert(prompts)
      .values({ slug: "other-draft" })
      .returning();
    if (!firstAsset || !secondAsset || !otherPrompt) {
      throw new Error("missing asset fixture");
    }

    await expectSqlState(
      () =>
        db.insert(assets).values({
          sourceKey: "too-many-pixels-source",
          originalKey: "too-many-pixels",
          width: 8000,
          height: 6000,
        }),
      "23514",
    );

    await db.insert(promptAssets).values([
      { promptId: prompt.id, assetId: firstAsset.id, position: 0 },
      { promptId: otherPrompt.id, assetId: firstAsset.id, position: 0 },
    ]);
    await expectSqlState(
      () =>
        db.insert(promptAssets).values({
          promptId: prompt.id,
          assetId: secondAsset.id,
          position: 0,
        }),
      "23505",
    );
    await expectSqlState(
      () => db.delete(assets).where(eq(assets.id, firstAsset.id)),
      "23503",
    );

    await db
      .delete(promptAssets)
      .where(eq(promptAssets.promptId, prompt.id));
    await expectSqlState(
      () => db.delete(assets).where(eq(assets.id, firstAsset.id)),
      "23503",
    );
    await db
      .delete(promptAssets)
      .where(eq(promptAssets.promptId, otherPrompt.id));
    await db.delete(assets).where(eq(assets.id, firstAsset.id));
  });
});
