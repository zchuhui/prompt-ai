import { sql } from "drizzle-orm";
import {
  boolean,
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
import { maxChars } from "./checks";
import { promptStatus, sourceType } from "./enums";
import { categories, models, tags } from "./taxonomies";

export const prompts = pgTable(
  "prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull().default(""),
    summary: text("summary"),
    promptText: text("prompt_text").notNull().default(""),
    negativePrompt: text("negative_prompt"),
    usageNotes: text("usage_notes"),
    parametersText: text("parameters_text"),
    modelVersion: text("model_version"),
    aspectRatio: text("aspect_ratio"),
    requiresReference: boolean("requires_reference").notNull().default(false),
    sourceType: sourceType("source_type").notNull().default("original"),
    sourceAuthor: text("source_author"),
    sourceUrl: text("source_url"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "restrict",
    }),
    modelId: uuid("model_id").references(() => models.id, {
      onDelete: "restrict",
    }),
    status: promptStatus("status").notNull().default("draft"),
    coverAssetId: uuid("cover_asset_id").references(() => assets.id, {
      onDelete: "restrict",
    }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("prompts_public_list_idx")
      .on(table.status, table.publishedAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    index("prompts_category_id_idx").on(table.categoryId),
    index("prompts_model_id_idx").on(table.modelId),
    check("prompts_slug_present", sql`char_length(${table.slug}) > 0`),
    check("prompts_title_length", maxChars(table.title, 120)),
    check("prompts_summary_length", maxChars(table.summary, 500)),
    check("prompts_prompt_text_length", maxChars(table.promptText, 50000)),
    check(
      "prompts_negative_prompt_length",
      maxChars(table.negativePrompt, 10000),
    ),
    check("prompts_usage_notes_length", maxChars(table.usageNotes, 10000)),
    check(
      "prompts_parameters_text_length",
      maxChars(table.parametersText, 10000),
    ),
    check("prompts_source_author_length", maxChars(table.sourceAuthor, 120)),
    check(
      "prompts_source_url",
      sql`${table.sourceUrl} is null or (char_length(${table.sourceUrl}) <= 2048 and (${table.sourceUrl} like 'https://%' or ${table.sourceUrl} like 'http://%'))`,
    ),
    check("prompts_version_positive", sql`${table.version} >= 1`),
    check(
      "prompts_published_at_present",
      sql`${table.status} <> 'published' or ${table.publishedAt} is not null`,
    ),
  ],
);

export const promptTags = pgTable(
  "prompt_tags",
  {
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.promptId, table.tagId] }),
    index("prompt_tags_tag_id_prompt_id_idx").on(table.tagId, table.promptId),
  ],
);

export const promptAssets = pgTable(
  "prompt_assets",
  {
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    alt: text("alt"),
  },
  (table) => [
    primaryKey({ columns: [table.promptId, table.assetId] }),
    unique("prompt_assets_prompt_id_position_unique").on(
      table.promptId,
      table.position,
    ),
    check(
      "prompt_assets_position_nonnegative",
      sql`${table.position} >= 0`,
    ),
    check("prompt_assets_alt_length", maxChars(table.alt, 300)),
  ],
);
