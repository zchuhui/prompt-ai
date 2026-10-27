import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { AppError } from "@/shared/errors";
import { pageOffset } from "@/shared/pagination";
import { createSlug } from "@/shared/slug";
import type { Database } from "@/server/db/client";
import { selectPublishedCards } from "@/features/prompts/server/queries";
import {
  assets,
  collectionPrompts,
  collections,
  promptAssets,
  prompts,
} from "@/server/db/schema";
const notFound = () => new AppError(404, "NOT_FOUND", "合集不存在");
const conflict = () => new AppError(409, "VERSION_CONFLICT", "合集已被其他人修改");

type PublicCollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_asset_id: string | null;
  updated_at: Date | string;
  member_count: number;
  covers: Array<{ id: string; width: number | null; height: number | null }> | null;
};

const publicMember = sql`
  join prompts p on p.id = cp.prompt_id
  where cp.collection_id = c.id
    and p.status = 'published'
    and p.deleted_at is null
`;

export async function listPublicCollections(db: Database) {
  const rows = await db.execute<PublicCollectionRow>(sql`
    select
      c.id,
      c.slug,
      c.title,
      c.description,
      c.cover_asset_id,
      c.updated_at,
      (select count(*)::int from collection_prompts cp ${publicMember}) as member_count,
      (
        select json_agg(json_build_object('id', a.id, 'width', a.width, 'height', a.height) order by picked.preferred desc, picked.position)
        from (
          select p.cover_asset_id, cp.position, (p.cover_asset_id = c.cover_asset_id) as preferred
          from collection_prompts cp ${publicMember}
            and p.cover_asset_id is not null
          order by (p.cover_asset_id = c.cover_asset_id) desc, cp.position
          limit 3
        ) picked
        join assets a on a.id = picked.cover_asset_id and a.status = 'ready'
      ) as covers
    from collections c
    where c.status = 'published'
      and exists (select 1 from collection_prompts cp ${publicMember})
    order by c.updated_at desc, c.id desc
  `);
  return rows.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    updatedAt: new Date(row.updated_at).toISOString(),
    memberCount: Number(row.member_count),
    covers: (row.covers ?? []).map((cover) => ({
      id: cover.id,
      width: cover.width ?? 1,
      height: cover.height ?? 1,
    })),
  }));
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
  const memberJoin = sql`join collection_prompts cp on cp.prompt_id = prompts.id and cp.collection_id = ${collection.id}`;
  const [countRow] = (
    await db.execute<{ value: number }>(sql`
      select count(*)::int as value
      from collection_prompts cp
      join prompts on prompts.id = cp.prompt_id
      where cp.collection_id = ${collection.id}
        and prompts.status = 'published'
        and prompts.deleted_at is null
    `)
  ).rows;
  const total = Number(countRow?.value ?? 0);
  if (total === 0) {
    return null;
  }
  const members = await selectPublishedCards(db, {
    extraJoins: memberJoin,
    where: sql`true`,
    orderBy: sql`cp.position asc`,
    limit: pageSize,
    offset: pageOffset(page, pageSize),
  });
  const [coverRow] = (
    await db.execute<{ id: string; width: number | null; height: number | null }>(sql`
      select a.id, a.width, a.height
      from collection_prompts cp
      join prompts on prompts.id = cp.prompt_id
      join assets a on a.id = prompts.cover_asset_id and a.status = 'ready'
      where cp.collection_id = ${collection.id}
        and prompts.status = 'published'
        and prompts.deleted_at is null
      order by (a.id = ${collection.coverAssetId}::uuid) desc nulls last, cp.position
      limit 1
    `)
  ).rows;
  return {
    id: collection.id,
    slug: collection.slug,
    title: collection.title,
    description: collection.description,
    cover: coverRow
      ? { id: coverRow.id, width: coverRow.width ?? 1, height: coverRow.height ?? 1 }
      : null,
    total,
    page,
    pageSize,
    members,
  };
}

export async function listAdminCollections(db: Database) {
  const rows = await db.execute<{
    id: string;
    slug: string;
    title: string;
    description: string | null;
    status: "draft" | "published";
    version: number;
    updated_at: Date | string;
    member_count: number;
  }>(sql`
    select c.id, c.slug, c.title, c.description, c.status, c.version, c.updated_at,
      (select count(*)::int from collection_prompts cp where cp.collection_id = c.id) as member_count
    from collections c
    order by c.updated_at desc, c.id desc
  `);
  return rows.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status,
    version: row.version,
    updatedAt: new Date(row.updated_at).toISOString(),
    memberCount: Number(row.member_count),
  }));
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
      deletedAt: prompts.deletedAt,
      coverAssetId: prompts.coverAssetId,
      coverStatus: assets.status,
    })
    .from(collectionPrompts)
    .innerJoin(prompts, eq(prompts.id, collectionPrompts.promptId))
    .leftJoin(assets, eq(assets.id, prompts.coverAssetId))
    .where(eq(collectionPrompts.collectionId, id))
    .orderBy(asc(collectionPrompts.position));
  return {
    id: collection.id,
    slug: collection.slug,
    title: collection.title,
    description: collection.description,
    status: collection.status,
    coverAssetId: collection.coverAssetId,
    version: collection.version,
    updatedAt: collection.updatedAt.toISOString(),
    members: members.map((member) => ({
      promptId: member.promptId,
      position: member.position,
      title: member.title,
      status: member.deletedAt ? ("deleted" as const) : member.status,
      coverAssetId: member.coverStatus === "ready" ? member.coverAssetId : null,
    })),
  };
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
