import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { collectionStatus } from "./enums";
import { prompts } from "./prompts";

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    coverAssetId: uuid("cover_asset_id").references(() => assets.id, {
      onDelete: "restrict",
    }),
    status: collectionStatus("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("collections_slug_present", sql`char_length(${table.slug}) > 0`),
    check("collections_version_positive", sql`${table.version} >= 1`),
  ],
);

export const collectionPrompts = pgTable(
  "collection_prompts",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.promptId] }),
    unique("collection_prompts_collection_id_position_unique").on(
      table.collectionId,
      table.position,
    ),
    index("collection_prompts_prompt_id_idx").on(table.promptId),
    check(
      "collection_prompts_position_nonnegative",
      sql`${table.position} >= 0`,
    ),
  ],
);
