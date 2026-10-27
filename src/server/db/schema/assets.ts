import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { assetStatus } from "./enums";

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: assetStatus("status").notNull().default("uploading"),
    sourceKey: text("source_key").notNull().unique(),
    originalKey: text("original_key").unique(),
    cardKey: text("card_key"),
    detailKey: text("detail_key"),
    mimeType: text("mime_type"),
    byteSize: integer("byte_size"),
    width: integer("width"),
    height: integer("height"),
    checksum: text("checksum"),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    readyAt: timestamp("ready_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("assets_status_created_at_idx").on(table.status, table.createdAt),
    check(
      "assets_byte_size_nonnegative",
      sql`${table.byteSize} is null or ${table.byteSize} >= 0`,
    ),
    check(
      "assets_dimensions",
      sql`(${table.width} is null and ${table.height} is null) or (${table.width} > 0 and ${table.height} > 0 and cast(${table.width} as bigint) * cast(${table.height} as bigint) <= 40000000)`,
    ),
    check(
      "assets_source_key_present",
      sql`char_length(${table.sourceKey}) > 0`,
    ),
    check(
      "assets_original_key_present",
      sql`${table.originalKey} is null or char_length(${table.originalKey}) > 0`,
    ),
  ],
);
