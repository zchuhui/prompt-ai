import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getInsights } from "../../src/features/analytics/server/insights";
import {
  createCollection,
  getAdminCollection,
  getPublicCollection,
  listPublicCollections,
  updateCollection,
} from "../../src/features/collections/server/service";
import {
  createEmptyPrompt,
  listRelatedPrompts,
  publishPrompt,
  unpublishPrompt,
  updatePrompt,
} from "../../src/features/prompts/server/service";
import { getAdminOverview } from "../../src/features/prompts/server/stats";
import { createInitialAdmin } from "../../src/server/auth/repository";
import { closeDatabase, createDatabase, type Database } from "../../src/server/db/client";
import {
  admins,
  analyticsEvents,
  assets,
  categories,
  models,
  promptAssets,
  prompts,
} from "../../src/server/db/schema";
import { loadLocalEnv } from "../../src/server/load-env";
import { truncateApplicationTables } from "./postgres";

loadLocalEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

describe("redesign support queries", () => {
  const pool = new Pool({ connectionString });
  let db: Database;
  let actor: { adminId: string; requestId: string };
  let categoryId: string;
  let modelId: string;

  async function readyAsset(width: number, height: number) {
    const [asset] = await db
      .insert(assets)
      .values({
        status: "ready",
        sourceKey: `private/${crypto.randomUUID()}`,
        originalKey: `public/${crypto.randomUUID()}/original.webp`,
        cardKey: `public/${crypto.randomUUID()}/card.webp`,
        detailKey: `public/${crypto.randomUUID()}/detail.webp`,
        width,
        height,
        mimeType: "image/webp",
      })
      .returning();
    if (!asset) {
      throw new Error("missing asset");
    }
    return asset;
  }

  async function publishedPrompt(title: string, width = 300, height = 400) {
    const created = await createEmptyPrompt(db, { ...actor, title });
    const asset = await readyAsset(width, height);
    await db.insert(promptAssets).values({
      promptId: created.id,
      assetId: asset.id,
      position: 0,
      alt: `${title} alt`,
    });
    const edited = await updatePrompt(
      db,
      created.id,
      {
        version: created.version,
        title,
        promptText: `${title} prompt`,
        categoryId,
        modelId,
        coverAssetId: asset.id,
      },
      actor,
    );
    const published = await publishPrompt(db, created.id, edited.version, actor);
    return { id: created.id, slug: created.slug, version: published.version, assetId: asset.id };
  }

  beforeAll(() => {
    db = createDatabase(pool);
  });

  beforeEach(async () => {
    await truncateApplicationTables(pool);
    await createInitialAdmin(db, { username: "editor", password: "correct-horse-battery" });
    const [admin] = await db.select().from(admins);
    const [category] = await db
      .insert(categories)
      .values({ name: "风景", normalizedName: "风景", slug: "landscape", sortOrder: 0 })
      .returning();
    const [model] = await db
      .insert(models)
      .values({ name: "Flux", normalizedName: "flux", slug: "flux", active: true, sortOrder: 0 })
      .returning();
    if (!admin || !category || !model) {
      throw new Error("missing fixture");
    }
    actor = { adminId: admin.id, requestId: "redesign" };
    categoryId = category.id;
    modelId = model.id;
  });

  afterAll(async () => {
    await closeDatabase();
    await pool.end();
  });

  it("allows a slug change only before the first publish", async () => {
    const first = await createEmptyPrompt(db, { ...actor, title: "" });
    const second = await createEmptyPrompt(db, { ...actor, title: "" });
    const renamed = await updatePrompt(
      db,
      first.id,
      { version: first.version, slug: "lotus-wallpaper" },
      actor,
    );
    const [row] = await db.select().from(prompts).where(eq(prompts.id, first.id));
    expect(row?.slug).toBe("lotus-wallpaper");

    await expect(
      updatePrompt(db, second.id, { version: second.version, slug: "lotus-wallpaper" }, actor),
    ).rejects.toMatchObject({ status: 409, code: "SLUG_CONFLICT" });

    await db
      .update(prompts)
      .set({ publishedAt: new Date() })
      .where(eq(prompts.id, first.id));
    await expect(
      updatePrompt(db, first.id, { version: renamed.version, slug: "lotus-2026" }, actor),
    ).rejects.toMatchObject({ status: 422, fields: { slug: expect.any(String) } });

    const unchanged = await updatePrompt(
      db,
      first.id,
      { version: renamed.version, slug: "lotus-wallpaper", title: "荷花" },
      actor,
    );
    expect(unchanged.version).toBe(renamed.version + 1);
  });

  it("returns covers for related prompts and collections and keeps member order", async () => {
    const a = await publishedPrompt("荷花", 300, 400);
    const b = await publishedPrompt("睡莲", 640, 480);
    const c = await publishedPrompt("荷叶", 500, 500);

    const related = await listRelatedPrompts(db, a.id);
    expect(related.map((item) => item.id).sort()).toEqual([b.id, c.id].sort());
    const relatedB = related.find((item) => item.id === b.id);
    expect(relatedB?.cover).toEqual({ id: b.assetId, width: 640, height: 480, alt: "睡莲 alt" });
    expect(relatedB?.modelName).toBe("Flux");

    const collection = await createCollection(db, { title: "夏日" });
    if (!collection) {
      throw new Error("missing collection");
    }
    await updateCollection(db, collection.id, {
      version: collection.version,
      status: "published",
      promptIds: [c.id, a.id, b.id],
      coverAssetId: a.assetId,
    });

    const admin = await getAdminCollection(db, collection.id);
    expect(admin.members.map((member) => member.promptId)).toEqual([c.id, a.id, b.id]);
    expect(admin.members[0]?.coverAssetId).toBe(c.assetId);

    const listed = await listPublicCollections(db);
    expect(listed[0]?.memberCount).toBe(3);
    expect(listed[0]?.covers.map((cover) => cover.id)).toEqual([a.assetId, c.assetId, b.assetId]);

    const page = await getPublicCollection(db, collection.slug, 1, 2);
    expect(page?.total).toBe(3);
    expect(page?.members.map((member) => member.id)).toEqual([c.id, a.id]);
    expect(page?.cover?.id).toBe(a.assetId);
    const second = await getPublicCollection(db, collection.slug, 2, 2);
    expect(second?.members.map((member) => member.id)).toEqual([b.id]);

    await unpublishPrompt(db, a.id, a.version, actor);
    const afterWithdraw = await getPublicCollection(db, collection.slug, 1, 24);
    expect(afterWithdraw?.members.map((member) => member.id)).toEqual([c.id, b.id]);
    expect(afterWithdraw?.cover?.id).toBe(c.assetId);
    expect((await listPublicCollections(db))[0]?.covers.map((cover) => cover.id)).not.toContain(
      a.assetId,
    );
  });

  it("aggregates insights without counting withdrawn prompts in the top list", async () => {
    const live = await publishedPrompt("公开");
    const withdrawn = await publishedPrompt("撤回");
    const now = new Date();
    const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    await db.insert(analyticsEvents).values([
      { eventId: "ev-detail-1", kind: "detail_view", promptId: live.id, path: "/p" },
      { eventId: "ev-detail-2", kind: "detail_view", promptId: live.id, path: "/p" },
      { eventId: "ev-copy-1", kind: "prompt_copy", promptId: live.id, path: "/p" },
      { eventId: "ev-copy-2", kind: "prompt_copy", promptId: withdrawn.id, path: "/p" },
      { eventId: "ev-empty-1", kind: "search_empty", path: "/", queryText: "赛博朋克" },
      { eventId: "ev-empty-2", kind: "search_empty", path: "/", queryText: " 赛博朋克 " },
      { eventId: "ev-search-1", kind: "search", path: "/", queryText: "荷花" },
      { eventId: "ev-old-1", kind: "prompt_copy", promptId: live.id, path: "/p", createdAt: old },
    ]);
    await unpublishPrompt(db, withdrawn.id, withdrawn.version, actor);

    const week = await getInsights(db, 7, now);
    expect(week.totals).toMatchObject({ detailViews: 2, copies: 2, searches: 3, emptySearches: 2 });
    expect(week.totals.copyRate).toBe(1);
    expect(week.topPrompts.map((item) => item.id)).toEqual([live.id]);
    expect(week.topPrompts[0]).toMatchObject({ detailViews: 2, copies: 1 });
    expect(week.emptySearches).toEqual([{ query: "赛博朋克", count: 2 }]);

    const month = await getInsights(db, 30, now);
    expect(month.totals.copies).toBe(3);

    const overview = await getAdminOverview(db);
    expect(overview).toMatchObject({ drafts: 1, published: 1 });
    expect(overview.recent[0]?.id).toBe(withdrawn.id);
  });
});
