import "server-only";

import { and, asc, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { AppError } from "@/shared/errors";
import { RELATED_LIMIT } from "@/shared/constants";
import { pageOffset } from "@/shared/pagination";
import { likePattern } from "@/shared/search";
import { createSlug } from "@/shared/slug";
import type { Database } from "@/server/db/client";
import {
  assets,
  auditLogs,
  categories,
  models,
  promptAssets,
  promptTags,
  prompts,
  tags,
} from "@/server/db/schema";
import { publishFieldErrors } from "../publish";
import type { PromptPatch } from "../schemas";
import { selectPublishedCards } from "./queries";

const notFound = () => new AppError(404, "NOT_FOUND", "内容不存在");
const conflict = () => new AppError(409, "VERSION_CONFLICT", "内容已被其他人修改");
const slugTaken = () =>
  new AppError(409, "SLUG_CONFLICT", "链接已被其他内容使用", { slug: "链接已被其他内容使用" });

function blankToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : value;
}

function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const record = error as { code?: unknown; cause?: unknown };
  if (typeof record.code === "string") {
    return record.code;
  }
  return sqlState(record.cause);
}

async function uniqueSlug(
  db: Database,
  title: string,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = createSlug(title);
    const [existing] = await db
      .select({ id: prompts.id })
      .from(prompts)
      .where(eq(prompts.slug, slug))
      .limit(1);
    if (!existing) {
      return slug;
    }
  }
  throw new AppError(500, "INTERNAL", "无法生成链接");
}

export async function createEmptyPrompt(
  db: Database,
  input: {
    title?: string;
    categoryId?: string | null;
    modelId?: string | null;
    tagIds?: string[];
    requestId: string;
    adminId: string;
  },
): Promise<{ id: string; slug: string; version: number }> {
  const slug = await uniqueSlug(db, input.title ?? "");
  try {
    const [created] = await db
      .insert(prompts)
      .values({
        slug,
        title: input.title ?? "",
        promptText: "",
        categoryId: input.categoryId ?? null,
        modelId: input.modelId ?? null,
        status: "draft",
      })
      .returning({ id: prompts.id, slug: prompts.slug, version: prompts.version });
    if (!created) {
      throw new AppError(500, "INTERNAL", "无法创建草稿");
    }
    if (input.tagIds && input.tagIds.length > 0) {
      await db.insert(promptTags).values(
        [...new Set(input.tagIds)].map((tagId) => ({
          promptId: created.id,
          tagId,
        })),
      );
    }
    await db.insert(auditLogs).values({
      adminId: input.adminId,
      action: "prompt.create",
      entityType: "prompt",
      entityId: created.id,
      requestId: input.requestId,
    });
    return created;
  } catch (error) {
    if (sqlState(error) === "23503") {
      throw new AppError(400, "INVALID_INPUT", "分类、模型或标签不存在");
    }
    throw error;
  }
}

export async function getAdminPrompt(db: Database, id: string) {
  const [prompt] = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.id, id), isNull(prompts.deletedAt)))
    .limit(1);
  if (!prompt) {
    throw notFound();
  }
  const images = await db
    .select({
      assetId: promptAssets.assetId,
      position: promptAssets.position,
      alt: promptAssets.alt,
      status: assets.status,
      width: assets.width,
      height: assets.height,
      errorCode: assets.errorCode,
    })
    .from(promptAssets)
    .innerJoin(assets, eq(assets.id, promptAssets.assetId))
    .where(eq(promptAssets.promptId, id))
    .orderBy(asc(promptAssets.position));
  const tagRows = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(promptTags)
    .innerJoin(tags, eq(tags.id, promptTags.tagId))
    .where(eq(promptTags.promptId, id));
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
    categoryId: prompt.categoryId,
    modelId: prompt.modelId,
    status: prompt.status,
    coverAssetId: prompt.coverAssetId,
    version: prompt.version,
    publishedAt: prompt.publishedAt?.toISOString() ?? null,
    updatedAt: prompt.updatedAt.toISOString(),
    tagIds: tagRows.map((tag) => tag.id),
    tags: tagRows,
    assetItems: images,
  };
}

async function loadPublishState(db: Database, id: string) {
  const prompt = await getAdminPrompt(db, id);
  const [model] = prompt.modelId
    ? await db
        .select({ id: models.id, active: models.active })
        .from(models)
        .where(eq(models.id, prompt.modelId))
        .limit(1)
    : [];
  return { prompt, model: model ?? null };
}

export async function updatePrompt(
  db: Database,
  id: string,
  patch: PromptPatch,
  actor: { adminId: string; requestId: string },
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, id), isNull(prompts.deletedAt)))
      .for("update")
      .limit(1);
    if (!current) {
      throw notFound();
    }
    if (current.version !== patch.version) {
      throw conflict();
    }

    const slug = patch.slug ?? current.slug;
    if (slug !== current.slug) {
      if (current.publishedAt) {
        throw new AppError(422, "UNPROCESSABLE", "首次发布后链接不能修改", {
          slug: "首次发布后链接不能修改",
        });
      }
      const [taken] = await tx
        .select({ id: prompts.id })
        .from(prompts)
        .where(eq(prompts.slug, slug))
        .limit(1);
      if (taken) {
        throw slugTaken();
      }
    }

    const next = {
      slug,
      title: patch.title ?? current.title,
      summary: patch.summary === undefined ? current.summary : blankToNull(patch.summary),
      promptText: patch.promptText ?? current.promptText,
      negativePrompt:
        patch.negativePrompt === undefined
          ? current.negativePrompt
          : blankToNull(patch.negativePrompt),
      usageNotes:
        patch.usageNotes === undefined ? current.usageNotes : blankToNull(patch.usageNotes),
      parametersText:
        patch.parametersText === undefined
          ? current.parametersText
          : blankToNull(patch.parametersText),
      modelVersion:
        patch.modelVersion === undefined
          ? current.modelVersion
          : blankToNull(patch.modelVersion),
      aspectRatio:
        patch.aspectRatio === undefined
          ? current.aspectRatio
          : blankToNull(patch.aspectRatio),
      requiresReference: patch.requiresReference ?? current.requiresReference,
      sourceType: patch.sourceType ?? current.sourceType,
      sourceAuthor:
        patch.sourceAuthor === undefined
          ? current.sourceAuthor
          : blankToNull(patch.sourceAuthor),
      sourceUrl: patch.sourceUrl === undefined ? current.sourceUrl : patch.sourceUrl,
      categoryId: patch.categoryId === undefined ? current.categoryId : patch.categoryId,
      modelId: patch.modelId === undefined ? current.modelId : patch.modelId,
      coverAssetId:
        patch.coverAssetId === undefined ? current.coverAssetId : patch.coverAssetId,
    };

    const tagIds = patch.tagIds
      ? [...new Set(patch.tagIds)]
      : (
          await tx
            .select({ tagId: promptTags.tagId })
            .from(promptTags)
            .where(eq(promptTags.promptId, id))
        ).map((row) => row.tagId);

    const existingImages = patch.assetItems
      ? null
      : await tx
          .select({
            assetId: promptAssets.assetId,
            position: promptAssets.position,
            alt: promptAssets.alt,
            status: assets.status,
          })
          .from(promptAssets)
          .innerJoin(assets, eq(assets.id, promptAssets.assetId))
          .where(eq(promptAssets.promptId, id));

    let images = existingImages ?? [];
    if (patch.assetItems) {
      const ids = [...new Set(patch.assetItems.map((item) => item.assetId))];
      const found = await tx
        .select({ id: assets.id, status: assets.status })
        .from(assets)
        .where(inArray(assets.id, ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]));
      const byId = new Map(found.map((asset) => [asset.id, asset.status]));
      if (found.length !== ids.length) {
        throw new AppError(400, "INVALID_INPUT", "图片不存在");
      }
      images = patch.assetItems.map((item) => ({
        assetId: item.assetId,
        position: item.position,
        alt: item.alt ?? null,
        status: byId.get(item.assetId) ?? "failed",
      }));
    }

    const [model] = next.modelId
      ? await tx
          .select({ active: models.active })
          .from(models)
          .where(eq(models.id, next.modelId))
          .limit(1)
      : [];
    if (next.modelId && !model) {
      throw new AppError(400, "INVALID_INPUT", "模型不存在");
    }
    if (next.categoryId) {
      const [category] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, next.categoryId))
        .limit(1);
      if (!category) {
        throw new AppError(400, "INVALID_INPUT", "分类不存在");
      }
    }
    if (tagIds.length > 0) {
      const foundTags = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.id, tagIds));
      if (foundTags.length !== tagIds.length) {
        throw new AppError(400, "INVALID_INPUT", "标签不存在");
      }
    }

    const coverAssetId =
      next.coverAssetId && images.some((image) => image.assetId === next.coverAssetId)
        ? next.coverAssetId
        : (images[0]?.assetId ?? null);

    if (current.status === "published") {
      const fields = publishFieldErrors({
        title: next.title,
        promptText: next.promptText,
        categoryId: next.categoryId,
        modelId: next.modelId,
        modelActive: model?.active ?? null,
        requireActiveModel: next.modelId !== current.modelId,
        coverAssetId,
        images: images.map((image) => ({ id: image.assetId, status: image.status })),
      });
      if (Object.keys(fields).length > 0) {
        throw new AppError(422, "UNPROCESSABLE", "发布条件不足", fields);
      }
    }

    const [updated] = await tx
      .update(prompts)
      .set({ ...next, coverAssetId, version: current.version + 1, updatedAt: new Date() })
      .where(and(eq(prompts.id, id), eq(prompts.version, patch.version)))
      .returning({ version: prompts.version })
      .catch((error: unknown) => {
        throw sqlState(error) === "23505" ? slugTaken() : error;
      });
    if (!updated) {
      throw conflict();
    }

    if (patch.tagIds) {
      await tx.delete(promptTags).where(eq(promptTags.promptId, id));
      if (tagIds.length > 0) {
        await tx.insert(promptTags).values(tagIds.map((tagId) => ({ promptId: id, tagId })));
      }
    }
    if (patch.assetItems) {
      await tx.delete(promptAssets).where(eq(promptAssets.promptId, id));
      if (images.length > 0) {
        await tx.insert(promptAssets).values(
          images.map((image) => ({
            promptId: id,
            assetId: image.assetId,
            position: image.position,
            alt: image.alt,
          })),
        );
      }
    }
    await tx.insert(auditLogs).values({
      adminId: actor.adminId,
      action: "prompt.update",
      entityType: "prompt",
      entityId: id,
      requestId: actor.requestId,
    });
    return { id, version: updated.version };
  });
}

async function changeStatus(
  db: Database,
  id: string,
  version: number,
  action: "publish" | "unpublish" | "delete",
  actor: { adminId: string; requestId: string },
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .for("update")
      .limit(1);
    if (!current || current.deletedAt) {
      throw notFound();
    }
    if (current.version !== version) {
      throw conflict();
    }
    if (action === "publish") {
      const state = await loadPublishState(tx as unknown as Database, id);
      const fields = publishFieldErrors({
        title: state.prompt.title,
        promptText: state.prompt.promptText,
        categoryId: state.prompt.categoryId,
        modelId: state.prompt.modelId,
        modelActive: state.model?.active ?? null,
        requireActiveModel: true,
        coverAssetId: state.prompt.coverAssetId,
        images: state.prompt.assetItems.map((image) => ({
          id: image.assetId,
          status: image.status,
        })),
      });
      if (Object.keys(fields).length > 0) {
        throw new AppError(422, "UNPROCESSABLE", "发布条件不足", fields);
      }
    }
    const [updated] = await tx
      .update(prompts)
      .set({
        status: action === "publish" ? "published" : "draft",
        publishedAt:
          action === "publish" ? (current.publishedAt ?? new Date()) : current.publishedAt,
        deletedAt: action === "delete" ? new Date() : current.deletedAt,
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(prompts.id, id), eq(prompts.version, version)))
      .returning({ version: prompts.version });
    if (!updated) {
      throw conflict();
    }
    await tx.insert(auditLogs).values({
      adminId: actor.adminId,
      action: `prompt.${action}`,
      entityType: "prompt",
      entityId: id,
      requestId: actor.requestId,
    });
    return { id, version: updated.version };
  });
}

export function publishPrompt(
  db: Database,
  id: string,
  version: number,
  actor: { adminId: string; requestId: string },
) {
  return changeStatus(db, id, version, "publish", actor);
}

export function unpublishPrompt(
  db: Database,
  id: string,
  version: number,
  actor: { adminId: string; requestId: string },
) {
  return changeStatus(db, id, version, "unpublish", actor);
}

export function deletePrompt(
  db: Database,
  id: string,
  version: number,
  actor: { adminId: string; requestId: string },
) {
  return changeStatus(db, id, version, "delete", actor);
}

export async function duplicatePrompt(
  db: Database,
  id: string,
  actor: { adminId: string; requestId: string },
) {
  const source = await getAdminPrompt(db, id);
  const slug = await uniqueSlug(db, source.title);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(prompts)
      .values({
        slug,
        title: source.title,
        summary: source.summary,
        promptText: source.promptText,
        negativePrompt: source.negativePrompt,
        usageNotes: source.usageNotes,
        parametersText: source.parametersText,
        modelVersion: source.modelVersion,
        aspectRatio: source.aspectRatio,
        requiresReference: source.requiresReference,
        sourceType: source.sourceType,
        sourceAuthor: source.sourceAuthor,
        sourceUrl: source.sourceUrl,
        categoryId: source.categoryId,
        modelId: source.modelId,
        coverAssetId: source.coverAssetId,
        status: "draft",
      })
      .returning({ id: prompts.id, slug: prompts.slug, version: prompts.version });
    if (!created) {
      throw new AppError(500, "INTERNAL", "无法复制草稿");
    }
    if (source.tagIds.length > 0) {
      await tx.insert(promptTags).values(
        source.tagIds.map((tagId) => ({ promptId: created.id, tagId })),
      );
    }
    if (source.assetItems.length > 0) {
      await tx.insert(promptAssets).values(
        source.assetItems.map((image) => ({
          promptId: created.id,
          assetId: image.assetId,
          position: image.position,
          alt: image.alt,
        })),
      );
    }
    await tx.insert(auditLogs).values({
      adminId: actor.adminId,
      action: "prompt.duplicate",
      entityType: "prompt",
      entityId: created.id,
      requestId: actor.requestId,
    });
    return created;
  });
}

export async function batchPrompts(
  db: Database,
  action: "publish" | "unpublish" | "delete",
  items: Array<{ id: string; version: number }>,
  actor: { adminId: string; requestId: string },
) {
  const results: Array<{
    id: string;
    ok: boolean;
    version?: number;
    error?: { code: string; message: string };
  }> = [];
  for (const item of items) {
    try {
      const updated = await changeStatus(db, item.id, item.version, action, actor);
      results.push({ id: item.id, ok: true, version: updated.version });
    } catch (error) {
      if (error instanceof AppError) {
        results.push({
          id: item.id,
          ok: false,
          error: { code: error.code, message: error.message },
        });
        continue;
      }
      results.push({
        id: item.id,
        ok: false,
        error: { code: "INTERNAL", message: "处理失败" },
      });
    }
  }
  return { results };
}

export async function listAdminPrompts(
  db: Database,
  input: {
    q?: string;
    status?: "draft" | "published";
    categoryId?: string;
    modelId?: string;
    page: number;
    pageSize: number;
  },
) {
  const filters = [isNull(prompts.deletedAt)];
  if (input.status) {
    filters.push(eq(prompts.status, input.status));
  }
  if (input.categoryId) {
    filters.push(eq(prompts.categoryId, input.categoryId));
  }
  if (input.modelId) {
    filters.push(eq(prompts.modelId, input.modelId));
  }
  if (input.q) {
    filters.push(ilike(prompts.title, likePattern(input.q)));
  }
  const where = and(...filters);
  const [countRow] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(prompts)
    .where(where);
  const rows = await db
    .select({
      id: prompts.id,
      title: prompts.title,
      slug: prompts.slug,
      status: prompts.status,
      version: prompts.version,
      categoryId: prompts.categoryId,
      modelId: prompts.modelId,
      coverAssetId: prompts.coverAssetId,
      updatedAt: prompts.updatedAt,
      categoryName: categories.name,
      modelName: models.name,
    })
    .from(prompts)
    .leftJoin(categories, eq(categories.id, prompts.categoryId))
    .leftJoin(models, eq(models.id, prompts.modelId))
    .where(where)
    .orderBy(desc(prompts.updatedAt), desc(prompts.id))
    .limit(input.pageSize)
    .offset(pageOffset(input.page, input.pageSize));
  return {
    items: rows.map((row) => ({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
    })),
    total: Number(countRow?.value ?? 0),
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function listRelatedPrompts(db: Database, id: string) {
  const [current] = await db
    .select({ categoryId: prompts.categoryId })
    .from(prompts)
    .where(eq(prompts.id, id))
    .limit(1);
  if (!current) {
    return [];
  }
  return selectPublishedCards(db, {
    where: sql`
      prompts.id <> ${id}
      and (
        (${current.categoryId}::uuid is not null and prompts.category_id = ${current.categoryId}::uuid)
        or exists (
          select 1 from prompt_tags mine
          join prompt_tags other on other.tag_id = mine.tag_id
          where mine.prompt_id = ${id} and other.prompt_id = prompts.id
        )
      )
    `,
    orderBy: sql`
      (exists (
        select 1 from prompt_tags mine
        join prompt_tags other on other.tag_id = mine.tag_id
        where mine.prompt_id = ${id} and other.prompt_id = prompts.id
      )) desc,
      prompts.published_at desc,
      prompts.id desc
    `,
    limit: RELATED_LIMIT,
  });
}
