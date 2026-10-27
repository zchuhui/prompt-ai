import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { AppError } from "@/shared/errors";
import { pageOffset } from "@/shared/pagination";
import { createSlug } from "@/shared/slug";
import type { Database } from "@/server/db/client";
import {
  assets,
  collectionPrompts,
  collections,
  promptAssets,
  prompts,
} from "@/server/db/schema";
const notFound = () => new AppError(404, "NOT_FOUND", "合集不存在");
const conflict = () => new AppError(409, "VERSION_CONFLICT", "合集已被其他人修改");

export async function listPublicCollections(db: Database) {
  const rows = await db.execute<{
    id: string;
    slug: string;
    title: string;
    description: string | null;
    cover_asset_id: string | null;
  }>(sql`
    select c.id, c.slug, c.title, c.description, c.cover_asset_id
    from collections c
    where c.status = 'published'
      and exists (
        select 1
        from collection_prompts cp
        join prompts p on p.id = cp.prompt_id
        where cp.collection_id = c.id
          and p.status = 'published'
          and p.deleted_at is null
      )
    order by c.updated_at desc, c.id desc
  `);
  return rows.rows;
}

export async function getPublicCollection(
  db: Database,
  slug: string,
  page: number,
  pageSize: number,
) {
  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.slug, slug), eq(collections.status, "published")))
    .limit(1);
  if (!collection) {
    return null;
  }
  const members = await db
    .select({
      id: prompts.id,
      slug: prompts.slug,
      title: prompts.title,
      summary: prompts.summary,
      position: collectionPrompts.position,
      coverAssetId: prompts.coverAssetId,
    })
    .from(collectionPrompts)
    .innerJoin(prompts, eq(prompts.id, collectionPrompts.promptId))
    .where(
      and(
        eq(collectionPrompts.collectionId, collection.id),
        eq(prompts.status, "published"),
        isNull(prompts.deletedAt),
      ),
    )
    .orderBy(asc(collectionPrompts.position))
    .limit(pageSize)
    .offset(pageOffset(page, pageSize));
  if (members.length === 0 && page === 1) {
    return null;
  }
  const coverId = members.some((member) => member.coverAssetId === collection.coverAssetId)
    ? collection.coverAssetId
    : (members[0]?.coverAssetId ?? null);
  return {
    id: collection.id,
    slug: collection.slug,
    title: collection.title,
    description: collection.description,
    coverAssetId: coverId,
    members,
  };
}

export async function listAdminCollections(db: Database) {
  return db.select().from(collections).orderBy(asc(collections.title));
}

export async function getAdminCollection(db: Database, id: string) {
  const [collection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);
  if (!collection) {
    throw notFound();
  }
  const members = await db
    .select({
      promptId: collectionPrompts.promptId,
      position: collectionPrompts.position,
      title: prompts.title,
      status: prompts.status,
    })
    .from(collectionPrompts)
    .innerJoin(prompts, eq(prompts.id, collectionPrompts.promptId))
    .where(eq(collectionPrompts.collectionId, id))
    .orderBy(asc(collectionPrompts.position));
  return { ...collection, members };
}

export async function createCollection(
  db: Database,
  input: { title: string; description?: string | null },
) {
  const title = input.title.trim();
  if (!title) {
    throw new AppError(400, "INVALID_INPUT", "标题不能为空");
  }
  const [created] = await db
    .insert(collections)
    .values({
      slug: createSlug(title),
      title,
      description: input.description ?? null,
      status: "draft",
    })
    .returning();
  return created;
}

export async function updateCollection(
  db: Database,
  id: string,
  input: {
    version: number;
    title?: string;
    description?: string | null;
    status?: "draft" | "published";
    coverAssetId?: string | null;
    promptIds?: string[];
  },
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .for("update")
      .limit(1);
    if (!current) {
      throw notFound();
    }
    if (current.version !== input.version) {
      throw conflict();
    }
    const promptIds = input.promptIds ? [...new Set(input.promptIds)] : null;
    if (promptIds) {
      await tx.delete(collectionPrompts).where(eq(collectionPrompts.collectionId, id));
      if (promptIds.length > 0) {
        await tx.insert(collectionPrompts).values(
          promptIds.map((promptId, position) => ({
            collectionId: id,
            promptId,
            position,
          })),
        );
      }
    }
    const memberIds =
      promptIds ??
      (
        await tx
          .select({ promptId: collectionPrompts.promptId })
          .from(collectionPrompts)
          .where(eq(collectionPrompts.collectionId, id))
      ).map((row) => row.promptId);
    let coverAssetId =
      input.coverAssetId === undefined ? current.coverAssetId : input.coverAssetId;
    if (coverAssetId) {
      const [valid] = await tx
        .select({ id: assets.id })
        .from(promptAssets)
        .innerJoin(assets, eq(assets.id, promptAssets.assetId))
        .where(
          and(
            eq(assets.id, coverAssetId),
            eq(assets.status, "ready"),
            sql`${promptAssets.promptId} in (${sql.join(
              memberIds.length > 0
                ? memberIds.map((promptId) => sql`${promptId}`)
                : [sql`null`],
              sql`, `,
            )})`,
          ),
        )
        .limit(1);
      if (!valid) {
        coverAssetId = null;
      }
    }
    const nextTitle = input.title?.trim() || current.title;
    const nextStatus = input.status ?? current.status;
    if (nextStatus === "published") {
      const fields = collectionPublishErrors({
        title: nextTitle,
        memberCount: memberIds.length,
      });
      if (Object.keys(fields).length > 0) {
        throw new AppError(422, "UNPROCESSABLE", "合集还不能发布", fields);
      }
    }
    const [updated] = await tx
      .update(collections)
      .set({
        title: nextTitle,
        description:
          input.description === undefined ? current.description : input.description,
        status: nextStatus,
        coverAssetId,
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(collections.id, id), eq(collections.version, input.version)))
      .returning();
    if (!updated) {
      throw conflict();
    }
    return updated;
  });
}

export async function deleteCollection(db: Database, id: string) {
  const deleted = await db.delete(collections).where(eq(collections.id, id)).returning();
  if (deleted.length === 0) {
    throw notFound();
  }
}

export function collectionPublishErrors(input: {
  title: string;
  memberCount: number;
}): Record<string, string> {
  return {
    ...(input.title.trim() ? {} : { title: "需要标题" }),
    ...(input.memberCount > 0 ? {} : { promptIds: "至少选择一条内容" }),
  };
}
