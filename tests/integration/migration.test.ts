import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import {
  connectionDatabaseName,
  migrateTestDatabaseName,
  withDatabase,
} from "../../src/server/db/database-url";
import { migrateDatabase, recreateDatabase } from "./postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsFolder = path.join(root, "drizzle");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const migrateUrl = withDatabase(
  databaseUrl,
  migrateTestDatabaseName(connectionDatabaseName(databaseUrl)),
);

const expectedTables = [
  "admins",
  "analytics_events",
  "assets",
  "audit_logs",
  "categories",
  "collection_prompts",
  "collections",
  "idempotency_keys",
  "jobs",
  "models",
  "prompt_assets",
  "prompt_tags",
  "prompts",
  "rate_limits",
  "sessions",
  "tags",
  "upload_batches",
  "upload_items",
];

const restrictedForeignKeys = [
  "prompts.category_id",
  "prompts.model_id",
  "prompts.cover_asset_id",
  "prompt_assets.asset_id",
  "collections.cover_asset_id",
  "upload_batches.admin_id",
  "upload_items.asset_id",
  "upload_items.prompt_id",
  "idempotency_keys.admin_id",
  "audit_logs.admin_id",
];

const cascadingForeignKeys = [
  "sessions.admin_id",
  "prompt_tags.prompt_id",
  "prompt_tags.tag_id",
  "prompt_assets.prompt_id",
  "collection_prompts.collection_id",
  "collection_prompts.prompt_id",
  "upload_items.batch_id",
];

describe("migrations", () => {
  const pool = new Pool({ connectionString: migrateUrl });
  pool.on("error", () => {
    // Recreating the database terminates this pool's open connections.
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates an empty database, applies the migration, and skips it on the next run", async () => {
    await recreateDatabase(
      withDatabase(databaseUrl, "postgres"),
      connectionDatabaseName(migrateUrl),
    );
    await migrateDatabase(migrateUrl, migrationsFolder);
    await migrateDatabase(migrateUrl, migrationsFolder);

    const tables = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    expect(tables.rows.map((row) => row.table_name).sort()).toEqual(expectedTables);

    const journal = await pool.query<{ count: number }>(
      "select count(*)::int as count from drizzle.__drizzle_migrations",
    );
    expect(journal.rows[0]?.count).toBe(2);

    const indexes = await pool.query<{ indexdef: string }>(
      `select indexdef from pg_indexes
       where schemaname = 'public' and indexname = 'prompts_public_list_idx'`,
    );
    const indexdef = indexes.rows[0]?.indexdef.toLowerCase() ?? "";
    expect(indexdef).toContain("published_at desc");
    expect(indexdef).toContain("id desc");
    expect(indexdef).toContain("deleted_at is null");

    const foreignKeys = await pool.query<{
      table_name: string;
      column_name: string;
      definition: string;
    }>(
      `select rel.relname as table_name, att.attname as column_name,
              pg_get_constraintdef(con.oid) as definition
       from pg_constraint con
       join pg_class rel on rel.oid = con.conrelid
       join pg_namespace nsp on nsp.oid = rel.relnamespace
       join lateral unnest(con.conkey) as cols(attnum) on true
       join pg_attribute att
         on att.attrelid = rel.oid and att.attnum = cols.attnum
       where nsp.nspname = 'public' and con.contype = 'f'`,
    );
    const definitions = new Map(
      foreignKeys.rows.map((row) => [
        `${row.table_name}.${row.column_name}`,
        row.definition,
      ]),
    );

    for (const key of restrictedForeignKeys) {
      expect(definitions.get(key)).toContain("ON DELETE RESTRICT");
    }
    for (const key of cascadingForeignKeys) {
      expect(definitions.get(key)).toContain("ON DELETE CASCADE");
    }
    expect(definitions.get("analytics_events.prompt_id")).toContain(
      "ON DELETE SET NULL",
    );
    expect(definitions.get("upload_batches.target_prompt_id")).toContain(
      "ON DELETE RESTRICT",
    );

    const columns = await pool.query<{ column_name: string; is_nullable: string }>(
      `select column_name, is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'assets'
         and column_name in ('source_key', 'original_key')`,
    );
    const nullable = new Map(columns.rows.map((row) => [row.column_name, row.is_nullable]));
    expect(nullable.get("source_key")).toBe("NO");
    expect(nullable.get("original_key")).toBe("YES");
  });

  it("upgrades a database that already has an asset from the initial migration", async () => {
    const previous = mkdtempSync(path.join(tmpdir(), "pg-migrate-"));
    mkdirSync(path.join(previous, "meta"));
    cpSync(path.join(migrationsFolder, "0000_init.sql"), path.join(previous, "0000_init.sql"));
    writeFileSync(
      path.join(previous, "meta", "_journal.json"),
      JSON.stringify({
        version: "7",
        dialect: "postgresql",
        entries: [
          {
            idx: 0,
            version: "7",
            when: 1793056369929,
            tag: "0000_init",
            breakpoints: true,
          },
        ],
      }),
    );

    try {
      await recreateDatabase(
        withDatabase(databaseUrl, "postgres"),
        connectionDatabaseName(migrateUrl),
      );
      await migrateDatabase(migrateUrl, previous);
      await pool.query("insert into assets (original_key) values ('legacy-original')");
      await migrateDatabase(migrateUrl, migrationsFolder);
      const upgraded = await pool.query<{ source_key: string; original_key: string }>(
        "select source_key, original_key from assets",
      );
      expect(upgraded.rows[0]?.original_key).toBe("legacy-original");
      expect(upgraded.rows[0]?.source_key).toMatch(/^legacy-source\//);
    } finally {
      rmSync(previous, { recursive: true, force: true });
    }
  });
});
