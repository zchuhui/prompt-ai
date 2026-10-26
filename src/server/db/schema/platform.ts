import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { admins } from "./admins";
import { maxChars } from "./checks";
import { analyticsEventKind } from "./enums";
import { prompts } from "./prompts";

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    adminId: uuid("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response").$type<Record<string, unknown>>(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" })
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.adminId, table.key] }),
    check("idempotency_keys_key_present", sql`char_length(${table.key}) > 0`),
    check(
      "idempotency_keys_request_hash_present",
      sql`char_length(${table.requestHash}) > 0`,
    ),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    keyHash: text("key_hash").notNull(),
    windowStart: timestamp("window_start", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    count: integer("count").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.keyHash, table.windowStart] }),
    check("rate_limits_key_hash_present", sql`char_length(${table.keyHash}) > 0`),
    check("rate_limits_count_nonnegative", sql`${table.count} >= 0`),
  ],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull().unique(),
    kind: analyticsEventKind("kind").notNull(),
    promptId: uuid("prompt_id").references(() => prompts.id, {
      onDelete: "set null",
    }),
    path: text("path").notNull(),
    queryText: text("query_text"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "analytics_events_event_id_present",
      sql`char_length(${table.eventId}) > 0`,
    ),
    check("analytics_events_path_present", sql`char_length(${table.path}) > 0`),
    check("analytics_events_query_text_length", maxChars(table.queryText, 100)),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    requestId: text("request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("audit_logs_action_present", sql`char_length(${table.action}) > 0`),
    check(
      "audit_logs_entity_type_present",
      sql`char_length(${table.entityType}) > 0`,
    ),
    check(
      "audit_logs_request_id_present",
      sql`char_length(${table.requestId}) > 0`,
    ),
  ],
);
