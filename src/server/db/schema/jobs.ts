import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { jobStatus } from "./enums";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    dedupeKey: text("dedupe_key").notNull().unique(),
    status: jobStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    runAt: timestamp("run_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    lockedUntil: timestamp("locked_until", {
      withTimezone: true,
      mode: "date",
    }),
    leaseToken: text("lease_token"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("jobs_status_run_at_idx").on(table.status, table.runAt),
    check("jobs_type_present", sql`char_length(${table.type}) > 0`),
    check("jobs_dedupe_key_present", sql`char_length(${table.dedupeKey}) > 0`),
    check("jobs_attempts_nonnegative", sql`${table.attempts} >= 0`),
  ],
);
