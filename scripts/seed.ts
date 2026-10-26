import { eq } from "drizzle-orm";
import { createDatabase, createPool, type Database } from "../src/server/db/client";
import {
  categories,
  models,
  promptTags,
  prompts,
  tags,
} from "../src/server/db/schema";
import { loadLocalEnv } from "../src/server/load-env";
import { normalizeName } from "../src/shared/normalize-name";

const categorySeeds = [
  { name: "壁纸", slug: "wallpaper", sortOrder: 0 },
  { name: "海报", slug: "poster", sortOrder: 1 },
  { name: "人像", slug: "portrait", sortOrder: 2 },
  { name: "角色", slug: "character", sortOrder: 3 },
] as const;

const tagSeeds = [
  { name: "治愈", slug: "healing" },
  { name: "植物", slug: "plant" },
  { name: "东方神话", slug: "eastern-mythology" },
  { name: "写实", slug: "realistic" },
  { name: "3D", slug: "3d" },
] as const;

const modelSeeds = [
  { name: "GPT Image", slug: "gpt-image", sortOrder: 0 },
  { name: "Flux", slug: "flux", sortOrder: 1 },
  { name: "Midjourney", slug: "midjourney", sortOrder: 2 },
] as const;

export async function seed(db: Database): Promise<void> {
  await db
    .insert(categories)
    .values(
      categorySeeds.map((category) => ({
        name: category.name,
        normalizedName: normalizeName(category.name),
        slug: category.slug,
        sortOrder: category.sortOrder,
      })),
    )
    .onConflictDoNothing({ target: categories.slug });

  await db
    .insert(tags)
    .values(
      tagSeeds.map((tag) => ({
        name: tag.name,
        normalizedName: normalizeName(tag.name),
        slug: tag.slug,
      })),
    )
    .onConflictDoNothing({ target: tags.slug });

  await db
    .insert(models)
    .values(
      modelSeeds.map((model) => ({
        name: model.name,
        normalizedName: normalizeName(model.name),
        slug: model.slug,
        description: null,
        active: true,
        sortOrder: model.sortOrder,
      })),
    )
    .onConflictDoNothing({ target: models.slug });

  const categoryRows = await db.select().from(categories);
  const tagRows = await db.select().from(tags);
  const modelRows = await db.select().from(models);
  const wallpaper = required(categoryRows, "wallpaper");
  const gptImage = required(modelRows, "gpt-image");

  await db
    .insert(prompts)
    .values([
      {
        slug: "draft-healing-plants",
        title: "治愈系植物壁纸",
        summary: "开发种子：未发布草稿",
        promptText: "soft morning light, monstera leaves\npale wall, film photograph",
        categoryId: wallpaper.id,
        modelId: gptImage.id,
        sourceType: "original",
        status: "draft",
      },
      {
        slug: "draft-empty",
        title: "",
        promptText: "",
        sourceType: "original",
        status: "draft",
      },
    ])
    .onConflictDoNothing({ target: prompts.slug });

  const [healing] = await db
    .select({ id: prompts.id })
    .from(prompts)
    .where(eq(prompts.slug, "draft-healing-plants"));
  if (!healing) {
    throw new Error("Missing seed prompt: draft-healing-plants");
  }

  const linkedTags = tagRows.filter(
    (tag) => tag.slug === "healing" || tag.slug === "plant",
  );
  await db
    .insert(promptTags)
    .values(
      linkedTags.map((tag) => ({
        promptId: healing.id,
        tagId: tag.id,
      })),
    )
    .onConflictDoNothing();
}

function required<T extends { slug: string }>(rows: T[], slug: string): T {
  const found = rows.find((row) => row.slug === slug);
  if (!found) {
    throw new Error(`Missing seed row: ${slug}`);
  }
  return found;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = createPool(connectionString);
  try {
    await seed(createDatabase(pool));
  } finally {
    await pool.end();
  }
}

if (process.env.VITEST !== "true") {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
