import "server-only";

import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { AppError } from "@/shared/errors";
import { pageOffset } from "@/shared/pagination";
import { likePattern } from "@/shared/search";
import { getDatabase, type Database } from "@/server/db/client";
import type { PromptCard, PromptCardPage } from "../types";
import {
  assets,
  categories,
  models,
  promptAssets,
  promptTags,
  prompts,
  tags,
} from "@/server/db/schema";

export async function listPublishedPrompts(db: Database) {
  return db
    .select({
      id: prompts.id,
      slug: prompts.slug,
      title: prompts.title,
      summary: prompts.summary,
      publishedAt: prompts.publishedAt,
    })
    .from(prompts)
    .where(and(eq(prompts.status, "published"), isNull(prompts.deletedAt)))
    .orderBy(desc(prompts.publishedAt), desc(prompts.id));
}

export type GalleryFilters = {
  q?: string;
  categorySlug?: string;
  modelSlug?: string;
  tagSlugs: string[];
  page: number;
  pageSize: number;
};

function publishedWhere(filters: GalleryFilters) {
  const conditions = [
    sql`${prompts.status} = 'published'`,
    sql`${prompts.deletedAt} is null`,
  ];
  if (filters.q) {
    const pattern = likePattern(filters.q);
    conditions.push(sql`(
      ${prompts.title} ilike ${pattern} escape '\\'
      or ${prompts.summary} ilike ${pattern} escape '\\'
      or ${prompts.promptText} ilike ${pattern} escape '\\'
      or exists (
        select 1 from prompt_tags pt
        join tags t on t.id = pt.tag_id
        where pt.prompt_id = ${prompts.id}
          and t.name ilike ${pattern} escape '\\'
      )
    )`);
  }
  if (filters.categorySlug) {
    conditions.push(sql`exists (
      select 1 from categories c
      where c.id = ${prompts.categoryId} and c.slug = ${filters.categorySlug}
    )`);
  }
  if (filters.modelSlug) {
    conditions.push(sql`exists (
      select 1 from models m
      where m.id = ${prompts.modelId} and m.slug = ${filters.modelSlug}
    )`);
  }
  if (filters.tagSlugs.length > 0) {
    conditions.push(sql`exists (
      select 1 from prompt_tags pt
      join tags t on t.id = pt.tag_id
      where pt.prompt_id = ${prompts.id}
        and t.slug in (${sql.join(filters.tagSlugs.map((slug) => sql`${slug}`), sql`, `)})
    )`);
  }
  return sql.join(conditions, sql` and `);
}

type CardRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  published_at: Date | string | null;
  model_name: string | null;
  model_slug: string | null;
  image_count: number;
  cover_id: string | null;
  cover_width: number | null;
  cover_height: number | null;
  cover_alt: string | null;
};

const cardColumns = sql`
  prompts.id,
  prompts.slug,
  prompts.title,
  prompts.summary,
  prompts.published_at,
  models.name as model_name,
  models.slug as model_slug,
  (select count(*)::int from prompt_assets pa where pa.prompt_id = prompts.id) as image_count,
  cover.id as cover_id,
  cover.width as cover_width,
  cover.height as cover_height,
  cover_link.alt as cover_alt
`;

const cardJoins = sql`
  left join models on models.id = prompts.model_id
  left join assets cover on cover.id = prompts.cover_asset_id and cover.status = 'ready'
  left join prompt_assets cover_link
    on cover_link.prompt_id = prompts.id and cover_link.asset_id = prompts.cover_asset_id
`;

function toCard(row: CardRow): PromptCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    modelName: row.model_name,
    modelSlug: row.model_slug,
    imageCount: Number(row.image_count),
    cover: row.cover_id
      ? {
          id: row.cover_id,
          width: row.cover_width ?? 1,
          height: row.cover_height ?? 1,
          alt: row.cover_alt,
        }
      : null,
  };
}

/**
 * Selects public cards. `extraJoins`, `where`, and `orderBy` must only
 * reference published, non-deleted prompts.
 */
export async function selectPublishedCards(
  db: Database,
  input: { extraJoins?: SQL; where: SQL; orderBy: SQL; limit: number; offset?: number },
): Promise<PromptCard[]> {
  const rows = await db.execute<CardRow>(sql`
    select ${cardColumns}
    from prompts
    ${cardJoins}
    ${input.extraJoins ?? sql``}
    where prompts.status = 'published' and prompts.deleted_at is null and ${input.where}
    order by ${input.orderBy}
    limit ${input.limit}
    offset ${input.offset ?? 0}
  `);
  return rows.rows.map(toCard);
}

export async function searchPublishedPrompts(
  db: Database,
  filters: GalleryFilters,
): Promise<PromptCardPage> {
  const where = publishedWhere(filters);
  const count = await db.execute<{ value: number }>(
    sql`select count(*)::int as value from prompts where ${where}`,
  );
  const items = await selectPublishedCards(db, {
    where,
    orderBy: sql`prompts.published_at desc, prompts.id desc`,
    limit: filters.pageSize,
    offset: pageOffset(filters.page, filters.pageSize),
  });
  return {
    total: Number(count.rows[0]?.value ?? 0),
    page: filters.page,
    pageSize: filters.pageSize,
    items,
  };
}

export async function countPublishedPrompts(db: Database): Promise<number> {
  const count = await db.execute<{ value: number }>(
    sql`select count(*)::int as value from prompts where status = 'published' and deleted_at is null`,
  );
  return Number(count.rows[0]?.value ?? 0);
}

export const getPublishedPromptCached = cache((slug: string) =>
  getPublishedPrompt(getDatabase(), slug),
);

export async function getPublishedPrompt(db: Database, slug: string) {
  const [prompt] = await db
    .select()
    .from(prompts)
    .where(
      and(eq(prompts.slug, slug), eq(prompts.status, "published"), isNull(prompts.deletedAt)),
    )
    .limit(1);
  if (!prompt) {
    return null;
  }
  const [category] = prompt.categoryId
    ? await db
        .select({ name: categories.name, slug: categories.slug })
        .from(categories)
        .where(eq(categories.id, prompt.categoryId))
        .limit(1)
    : [];
  const [model] = prompt.modelId
    ? await db
        .select({ name: models.name, slug: models.slug })
        .from(models)
        .where(eq(models.id, prompt.modelId))
        .limit(1)
    : [];
  const images = await db
    .select({
      id: assets.id,
      width: assets.width,
      height: assets.height,
      alt: promptAssets.alt,
      position: promptAssets.position,
    })
    .from(promptAssets)
    .innerJoin(assets, eq(assets.id, promptAssets.assetId))
    .where(and(eq(promptAssets.promptId, prompt.id), eq(assets.status, "ready")))
    .orderBy(asc(promptAssets.position));
  const tagRows = await db
    .select({ name: tags.name, slug: tags.slug })
    .from(promptTags)
    .innerJoin(tags, eq(tags.id, promptTags.tagId))
    .where(eq(promptTags.promptId, prompt.id));
  return {
    id: prompt.id,
    slug: prompt.slug,
    title: prompt.title,
    summary: prompt.summary,
    promptText: prompt.promptText,
    negativePrompt: prompt.negativePrompt,
    usageNotes: prompt.usageNotes,
    parametersText: prompt.parametersText,
    modelVersion: prompt.modelVersion,
    aspectRatio: prompt.aspectRatio,
    requiresReference: prompt.requiresReference,
    sourceType: prompt.sourceType,
    sourceAuthor: prompt.sourceAuthor,
    sourceUrl: prompt.sourceUrl,
    publishedAt: prompt.publishedAt?.toISOString() ?? null,
    category: category ?? null,
    model: model ?? null,
    tags: tagRows,
    images: images.map((image) => ({
      ...image,
      width: image.width ?? 1,
      height: image.height ?? 1,
    })),
  };
}

export async function publicMedia(db: Database, assetId: string, variant: string) {
  if (variant !== "card" && variant !== "detail" && variant !== "original") {
    throw new AppError(404, "NOT_FOUND", "图片不存在");
  }
  const [row] = await db
    .select({
      status: assets.status,
      cardKey: assets.cardKey,
      detailKey: assets.detailKey,
      originalKey: assets.originalKey,
      width: assets.width,
      height: assets.height,
    })
    .from(assets)
    .innerJoin(promptAssets, eq(promptAssets.assetId, assets.id))
    .innerJoin(prompts, eq(prompts.id, promptAssets.promptId))
    .where(
      and(
        eq(assets.id, assetId),
        eq(assets.status, "ready"),
        eq(prompts.status, "published"),
        isNull(prompts.deletedAt),
      ),
    )
    .limit(1);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "图片不存在");
  }
  const key =
    variant === "card" ? row.cardKey : variant === "detail" ? row.detailKey : row.originalKey;
  if (!key) {
    throw new AppError(404, "NOT_FOUND", "图片不存在");
  }
  return { key, width: row.width ?? 1, height: row.height ?? 1 };
}

export async function adminMedia(db: Database, assetId: string, variant: string) {
  if (variant !== "card" && variant !== "detail" && variant !== "original") {
    throw new AppError(404, "NOT_FOUND", "图片不存在");
  }
  const [row] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "图片不存在");
  }
  const key =
    variant === "card" ? row.cardKey : variant === "detail" ? row.detailKey : row.originalKey;
  if (!key) {
    throw new AppError(404, "NOT_FOUND", "图片不存在");
  }
  return { key, width: row.width ?? 1, height: row.height ?? 1 };
}

export async function listFilters(db: Database) {
  const [categoryRows, tagRows, modelRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select().from(tags).orderBy(asc(tags.name)),
    db
      .select()
      .from(models)
      .where(eq(models.active, true))
      .orderBy(asc(models.sortOrder), asc(models.name)),
  ]);
  return {
    categories: categoryRows.map(({ id, name, slug }) => ({ id, name, slug })),
    tags: tagRows.map(({ id, name, slug }) => ({ id, name, slug })),
    models: modelRows.map(({ id, name, slug, description }) => ({
      id,
      name,
      slug,
      description,
    })),
  };
}
