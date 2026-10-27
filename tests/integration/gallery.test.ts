import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import sitemap from "../../src/app/sitemap";
import { GET as live } from "../../src/app/api/health/live/route";
import { GET as ready } from "../../src/app/api/health/ready/route";
import { GET as publicMediaRoute } from "../../src/app/api/v1/media/[id]/[variant]/route";
import { POST as postEvent } from "../../src/app/api/v1/events/route";
import { recordEvent } from "../../src/features/analytics/server/service";
import {
  getPublicCollection,
  listPublicCollections,
  updateCollection,
  createCollection,
} from "../../src/features/collections/server/service";
import {
  createEmptyPrompt,
  listRelatedPrompts,
  publishPrompt,
  unpublishPrompt,
  updatePrompt,
} from "../../src/features/prompts/server/service";
import { searchPublishedPrompts } from "../../src/features/prompts/server/queries";
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
  rateLimits,
  tags,
} from "../../src/server/db/schema";
import { resetProcessEnvForTests } from "../../src/server/env-core";
import { getEnv } from "../../src/server/env";
import { loadLocalEnv } from "../../src/server/load-env";
import { MemoryStorage, setStorageForTests } from "../../src/server/storage";
import { truncateApplicationTables } from "./postgres";

loadLocalEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const origin = process.env.APP_URL ?? "http://localhost:3000";

describe("public gallery, collections, and events", () => {
  const pool = new Pool({ connectionString });
  let db: Database;

  beforeAll(() => {
    process.env.STORAGE_DRIVER = "memory";
    resetProcessEnvForTests();
    db = createDatabase(pool);
  });

  beforeEach(async () => {
    await truncateApplicationTables(pool);
    const storage = new MemoryStorage();
    await storage.put("public/card.webp", Buffer.from("card"), "image/webp");
    setStorageForTests(storage);
    await createInitialAdmin(db, { username: "editor", password: "correct-horse-battery" });
  });

  afterAll(async () => {
    setStorageForTests(undefined);
    delete process.env.STORAGE_DRIVER;
    resetProcessEnvForTests();
    await closeDatabase();
    await pool.end();
  });

  it("hides withdrawn prompts from search, media, collections, related items, and the sitemap", async () => {
    const [admin] = await db.select().from(admins);
    const [category] = await db
      .insert(categories)
      .values({ name: "风景", normalizedName: "风景", slug: "landscape", sortOrder: 0 })
      .returning();
    const [model] = await db
      .insert(models)
      .values({ name: "Flux", normalizedName: "flux", slug: "flux", active: true, sortOrder: 0 })
      .returning();
    const [tag] = await db
      .insert(tags)
      .values({ name: "荷花", normalizedName: "荷花", slug: "lotus" })
      .returning();
    if (!admin || !category || !model || !tag) {
      throw new Error("missing fixture");
    }
    const actor = { adminId: admin.id, requestId: "gallery" };
    const created = await createEmptyPrompt(db, { ...actor, title: "荷花" });
    const other = await createEmptyPrompt(db, { ...actor, title: "荷花二" });
    const [asset] = await db
      .insert(assets)
      .values({
        status: "ready",
        sourceKey: "private/source",
        originalKey: "public/original.webp",
        cardKey: "public/card.webp",
        detailKey: "public/detail.webp",
        width: 8,
        height: 8,
        mimeType: "image/webp",
      })
      .returning();
    if (!asset) {
      throw new Error("missing asset");
    }
    await db.insert(promptAssets).values([
      { promptId: created.id, assetId: asset.id, position: 0, alt: "荷花" },
      { promptId: other.id, assetId: asset.id, position: 0, alt: "荷花" },
    ]);
    const edited = await updatePrompt(
      db,
      created.id,
      {
        version: created.version,
        title: "荷花",
        promptText: "第一行\n第二行",
        categoryId: category.id,
        modelId: model.id,
        tagIds: [tag.id],
        coverAssetId: asset.id,
      },
      actor,
    );
    await updatePrompt(
      db,
      other.id,
      {
        version: other.version,
        title: "荷花二",
        promptText: "另一条",
        categoryId: category.id,
        modelId: model.id,
        tagIds: [tag.id],
        coverAssetId: asset.id,
      },
      actor,
    );
    await publishPrompt(db, created.id, edited.version, actor);
    const otherEdited = await db.select().from(prompts).where(eq(prompts.id, other.id));
    await publishPrompt(db, other.id, otherEdited[0]!.version, actor);

    const found = await searchPublishedPrompts(db, {
      q: "荷花",
      tagSlugs: ["lotus"],
      categorySlug: "landscape",
      modelSlug: "flux",
      page: 1,
      pageSize: 24,
    });
    expect(found.items.map((item) => item.slug).sort()).toEqual(
      [created.slug, other.slug].sort(),
    );
    const media = await publicMediaRoute(
      new Request(`${origin}/api/v1/media/${asset.id}/card`),
      { params: Promise.resolve({ id: asset.id, variant: "card" }) },
    );
    expect(media.status).toBe(200);
    expect(media.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await media.arrayBuffer()).toString()).toBe("card");

    const collection = await createCollection(db, { title: "夏日" });
    if (!collection) {
      throw new Error("missing collection");
    }
    await updateCollection(db, collection.id, {
      version: collection.version,
      status: "published",
      promptIds: [created.id, other.id],
    });
    expect((await listPublicCollections(db)).map((item) => item.slug)).toContain(collection.slug);
    const related = await listRelatedPrompts(db, created.id);
    expect(related.map((item) => item.id)).toContain(other.id);
    const listed = await sitemap();
    expect(listed.some((item) => item.url.endsWith(`/prompts/${created.slug}`))).toBe(true);
    expect(listed.some((item) => item.url.endsWith(`/collections/${collection.slug}`))).toBe(true);

    const event = await postEvent(
      new Request(`${origin}/api/v1/events`, {
        method: "POST",
        headers: { origin, "content-type": "application/json", "x-real-ip": "203.0.113.50" },
        body: JSON.stringify({
          eventId: "event-0001",
          kind: "prompt_copy",
          promptId: created.id,
          path: `/prompts/${created.slug}`,
        }),
      }),
    );
    expect(event.status).toBe(202);
    const [storedEvent] = await db.select().from(analyticsEvents);
    expect(storedEvent?.promptId).toBe(created.id);
    expect(JSON.stringify(storedEvent)).not.toContain("203.0.113.50");

    await unpublishPrompt(db, created.id, edited.version + 1, actor);
    const hidden = await searchPublishedPrompts(db, {
      q: "荷花",
      tagSlugs: [],
      page: 1,
      pageSize: 24,
    });
    expect(hidden.items.map((item) => item.id)).not.toContain(created.id);
    const gone = await publicMediaRoute(
      new Request(`${origin}/api/v1/media/${asset.id}/card`),
      { params: Promise.resolve({ id: asset.id, variant: "card" }) },
    );
    expect(gone.status).toBe(200);
    await unpublishPrompt(db, other.id, otherEdited[0]!.version + 1, actor);
    const privateMedia = await publicMediaRoute(
      new Request(`${origin}/api/v1/media/${asset.id}/original`),
      { params: Promise.resolve({ id: asset.id, variant: "original" }) },
    );
    expect(privateMedia.status).toBe(404);
    expect(await getPublicCollection(db, collection.slug, 1, 24)).toBeNull();
    expect(await listRelatedPrompts(db, created.id)).toEqual([]);
    const after = await sitemap();
    expect(after.some((item) => item.url.includes(created.slug))).toBe(false);
    expect(after.some((item) => item.url.includes(collection.slug))).toBe(false);

    await expect(
      recordEvent(db, {
        rawBody: JSON.stringify({
          eventId: "event-0002",
          kind: "detail_view",
          promptId: created.id,
          path: "/prompts/x",
        }),
        ip: "203.0.113.51",
        secret: getEnv().RATE_LIMIT_SECRET,
        body: {
          eventId: "event-0002",
          kind: "detail_view",
          promptId: created.id,
          path: "/prompts/x",
        },
      }),
    ).rejects.toMatchObject({ status: 404 });

    await db.update(rateLimits).set({ count: 60 });
    await expect(
      recordEvent(db, {
        rawBody: JSON.stringify({ eventId: "event-0003", kind: "page_view", path: "/" }),
        ip: "203.0.113.50",
        secret: getEnv().RATE_LIMIT_SECRET,
        body: { eventId: "event-0003", kind: "page_view", path: "/" },
      }),
    ).rejects.toMatchObject({ status: 429 });

    expect((await live()).status).toBe(200);
    expect((await ready()).status).toBe(200);
  });
});
