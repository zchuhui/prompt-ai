import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { canonicalName } from "./checks";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull().unique(),
    slug: text("slug").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    check("categories_slug_present", sql`char_length(${table.slug}) > 0`),
    check("categories_normalized_name_form", canonicalName(table.normalizedName)),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull().unique(),
    slug: text("slug").notNull().unique(),
  },
  (table) => [
    check("tags_slug_present", sql`char_length(${table.slug}) > 0`),
    check("tags_normalized_name_form", canonicalName(table.normalizedName)),
  ],
);

export const models = pgTable(
  "models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull().unique(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    check("models_slug_present", sql`char_length(${table.slug}) > 0`),
    check("models_normalized_name_form", canonicalName(table.normalizedName)),
  ],
);
