import { eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listPublishedPrompts } from "../../src/features/prompts/server/queries";
import { createDatabase, type Database } from "../../src/server/db/client";
import {
  categories,
  models,
  promptTags,
  prompts,
  tags,
} from "../../src/server/db/schema";
import { seed } from "../../scripts/seed";
import { truncateApplicationTables } from "./postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

describe("seed", () => {
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

  it("inserts draft fixtures once and does not overwrite later edits", async () => {
    await seed(db);
    await seed(db);

    const [counts] = await db
      .select({
        categories: sql<number>`(select count(*) from categories)::int`,
        tags: sql<number>`(select count(*) from tags)::int`,
        models: sql<number>`(select count(*) from models)::int`,
        prompts: sql<number>`(select count(*) from prompts)::int`,
        promptTags: sql<number>`(select count(*) from prompt_tags)::int`,
      })
      .from(categories)
      .limit(1);
    expect(counts).toEqual({
      categories: 4,
      tags: 5,
      models: 3,
      prompts: 2,
      promptTags: 2,
    });

    const [gptImage] = await db
      .select()
      .from(models)
      .where(eq(models.slug, "gpt-image"));
    expect(gptImage?.normalizedName).toBe("gpt image");

    const [healing] = await db
      .select()
      .from(prompts)
      .where(eq(prompts.slug, "draft-healing-plants"));
    expect(healing?.status).toBe("draft");
    expect(healing?.promptText).toBe(
      "soft morning light, monstera leaves\npale wall, film photograph",
    );
    expect(await listPublishedPrompts(db)).toEqual([]);

    const linked = await db
      .select({ slug: tags.slug })
      .from(promptTags)
      .innerJoin(tags, eq(tags.id, promptTags.tagId))
      .innerJoin(prompts, eq(prompts.id, promptTags.promptId))
      .where(eq(prompts.slug, "draft-healing-plants"));
    expect(linked.map((row) => row.slug).sort()).toEqual(["healing", "plant"]);

    await db
      .update(prompts)
      .set({ title: "本地修改" })
      .where(eq(prompts.slug, "draft-empty"));
    await seed(db);
    const [emptyDraft] = await db
      .select({ title: prompts.title })
      .from(prompts)
      .where(eq(prompts.slug, "draft-empty"));
    expect(emptyDraft?.title).toBe("本地修改");
  });
});
