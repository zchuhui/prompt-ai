import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { admins } from "./admins";
import { assets } from "./assets";
import { maxChars } from "./checks";
import { uploadItemStatus, uploadMode } from "./enums";
import { prompts } from "./prompts";

export const uploadBatches = pgTable("upload_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  mode: uploadMode("mode").notNull(),
  defaults: jsonb("defaults")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => admins.id, { onDelete: "restrict" }),
  targetPromptId: uuid("target_prompt_id").references(() => prompts.id, {
    onDelete: "restrict",
  }),
});

export const uploadItems = pgTable(
  "upload_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => uploadBatches.id, { onDelete: "cascade" }),
    clientItemId: text("client_item_id").notNull(),
    assetId: uuid("asset_id").references(() => assets.id, {
      onDelete: "restrict",
    }),
    promptId: uuid("prompt_id").references(() => prompts.id, {
      onDelete: "restrict",
    }),
    status: uploadItemStatus("status").notNull().default("pending"),
    errorCode: text("error_code"),
    position: integer("position").notNull(),
    declaredSize: integer("declared_size").notNull(),
    declaredType: text("declared_type").notNull(),
    fileName: text("file_name").notNull(),
  },
  (table) => [
    unique("upload_items_batch_id_client_item_id_unique").on(
      table.batchId,
      table.clientItemId,
    ),
    check(
      "upload_items_client_item_id_present",
      sql`char_length(${table.clientItemId}) > 0`,
    ),
    check("upload_items_position_nonnegative", sql`${table.position} >= 0`),
    check(
      "upload_items_declared_size_nonnegative",
      sql`${table.declaredSize} >= 0`,
    ),
    check(
      "upload_items_declared_type_present",
      sql`char_length(${table.declaredType}) > 0`,
    ),
    check(
      "upload_items_file_name_present",
      sql`char_length(${table.fileName}) > 0`,
    ),
    check("upload_items_file_name_length", maxChars(table.fileName, 300)),
  ],
);
