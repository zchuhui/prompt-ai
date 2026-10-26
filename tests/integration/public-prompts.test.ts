import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listPublishedPrompts } from "../../src/features/prompts/server/queries";
import { createDatabase, type Database } from "../../src/server/db/client";
import { prompts } from "../../src/server/db/schema";
import { truncateApplicationTables } from "./postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const publishedAt = new Date("2026-02-01T00:00:00.000Z");
const older = new Date("2026-01-01T00:00:00.000Z");

describe("published prompt queries", () => {
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

  it("returns published prompts and hides drafts and deletions", async () => {
    await db.insert(prompts).values([
      {
        id: "00000000-0000-4000-8000-000000000001",
        slug: "newer-lower-id",
        title: "较新",
        status: "published",
        publishedAt,
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        slug: "newer-higher-id",
        title: "同一时间更靠后",
        status: "published",
        publishedAt,
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        slug: "older",
        title: "更早",
        status: "published",
        publishedAt: older,
      },
      {
        id: "00000000-0000-4000-8000-000000000004",
        slug: "draft",
        title: "草稿",
        status: "draft",
        publishedAt,
      },
      {
        id: "00000000-0000-4000-8000-000000000005",
        slug: "deleted",
        title: "已删除",
        status: "published",
        publishedAt,
        deletedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ]);

    const rows = await listPublishedPrompts(db);
    expect(rows.map((row) => row.slug)).toEqual([
      "newer-higher-id",
      "newer-lower-id",
      "older",
    ]);
  });
});
