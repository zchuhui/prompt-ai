import { sql } from "drizzle-orm";
import {
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { admins } from "./admins";
import { assets } from "./assets";
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
  ],
);
