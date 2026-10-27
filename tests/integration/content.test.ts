import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createInitialAdmin } from "../../src/server/auth/repository";
import { closeDatabase, createDatabase, type Database } from "../../src/server/db/client";
import { admins, categories, models, prompts } from "../../src/server/db/schema";
import { loadLocalEnv } from "../../src/server/load-env";
import {
  batchPrompts,
  createEmptyPrompt,
  duplicatePrompt,
  publishPrompt,
  unpublishPrompt,
  updatePrompt,
} from "../../src/features/prompts/server/service";
import { getPublishedPrompt, searchPublishedPrompts } from "../../src/features/prompts/server/queries";
import { truncateApplicationTables } from "./postgres";

loadLocalEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

describe("prompt publishing", () => {
  const pool = new Pool({ connectionString });
  let db: Database;

  beforeAll(() => {
    db = createDatabase(pool);
  });

  beforeEach(async () => {
    await truncateApplicationTables(pool);
    await createInitialAdmin(db, { username: "editor", password: "correct-horse-battery" });
    await db.insert(categories).values({
      name: "风景",
      normalizedName: "风景",
      slug: "landscape",
      sortOrder: 0,
    });
    await db.insert(models).values({
      name: "Flux",
      normalizedName: "flux",
      slug: "flux",
      active: true,
      sortOrder: 0,
    });
  });

  afterAll(async () => {
    await closeDatabase();
    await pool.end();
  });

  it("rejects an incomplete publish and hides a withdrawn prompt", async () => {
    const [admin] = await db.select().from(admins);
    if (!admin) {
      throw new Error("missing admin");
    }
    const created = await createEmptyPrompt(db, {
      adminId: admin.id,
      requestId: "test",
    });
    await expect(
      publishPrompt(db, created.id, created.version, {
        adminId: admin.id,
        requestId: "test",
      }),
    ).rejects.toMatchObject({ status: 422 });

    const [category] = await db.select().from(categories);
    const [model] = await db.select().from(models);
    if (!category || !model) {
      throw new Error("missing taxonomy");
    }
    const updated = await updatePrompt(
      db,
      created.id,
      {
        version: created.version,
        title: "荷花",
        promptText: "第一行\n第二行",
        categoryId: category.id,
        modelId: model.id,
      },
      { adminId: admin.id, requestId: "test" },
    );
    await expect(
      publishPrompt(db, created.id, updated.version, {
        adminId: admin.id,
        requestId: "test",
      }),
    ).rejects.toMatchObject({ status: 422 });

    const conflict = updatePrompt(
      db,
      created.id,
      { version: created.version, title: "过期标题" },
      { adminId: admin.id, requestId: "test" },
    );
    await expect(conflict).rejects.toMatchObject({ status: 409 });

    const published = await db
      .update(prompts)
      .set({ status: "published", publishedAt: new Date(), version: updated.version + 1 })
      .returning();
    expect(published).toHaveLength(1);
    await unpublishPrompt(db, created.id, updated.version + 1, {
      adminId: admin.id,
      requestId: "test",
    });
    expect(await getPublishedPrompt(db, created.slug)).toBeNull();
    const listed = await searchPublishedPrompts(db, {
      q: "荷花",
      tagSlugs: [],
      page: 1,
      pageSize: 24,
    });
    expect(listed.items).toHaveLength(0);
  });

  it("returns a per-item result when a batch is only partly valid", async () => {
    const [admin] = await db.select().from(admins);
    if (!admin) {
      throw new Error("missing admin");
    }
    const actor = { adminId: admin.id, requestId: "batch" };
    const first = await createEmptyPrompt(db, actor);
    const second = await createEmptyPrompt(db, actor);
    const result = await batchPrompts(
      db,
      "publish",
      [
        { id: first.id, version: first.version },
        { id: second.id, version: second.version + 9 },
      ],
      actor,
    );
    expect(result.results.map((item) => item.ok)).toEqual([false, false]);
    expect(result.results[0]?.error?.code).toBe("UNPROCESSABLE");
    expect(result.results[1]?.error?.code).toBe("VERSION_CONFLICT");

    const removed = await batchPrompts(
      db,
      "delete",
      [
        { id: first.id, version: first.version },
        { id: "00000000-0000-4000-8000-000000000099", version: 1 },
      ],
      actor,
    );
    expect(removed.results[0]?.ok).toBe(true);
    expect(removed.results[1]?.ok).toBe(false);
    const copy = await duplicatePrompt(db, second.id, actor);
    expect(copy.slug).not.toBe(second.slug);
    expect(copy.id).not.toBe(second.id);
  });
});
