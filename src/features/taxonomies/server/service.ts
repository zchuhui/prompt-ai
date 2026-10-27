import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { AppError } from "@/shared/errors";
import { createSlug } from "@/shared/slug";
import { normalizeName } from "@/shared/normalize-name";
import type { Database } from "@/server/db/client";
import { categories, models, prompts, tags } from "@/server/db/schema";

function conflict(message: string): AppError {
  return new AppError(409, "CONFLICT", message);
}

function referenced(): AppError {
  return new AppError(409, "CONFLICT", "仍被内容引用，不能删除");
}

async function slugFor(name: string): Promise<string> {
  return createSlug(name);
}

export async function listAdminTaxonomies(db: Database) {
  const [categoryRows, tagRows, modelRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select().from(tags).orderBy(asc(tags.name)),
    db.select().from(models).orderBy(asc(models.sortOrder), asc(models.name)),
  ]);
  return { categories: categoryRows, tags: tagRows, models: modelRows };
}

export async function createCategory(
  db: Database,
  input: { name: string; sortOrder?: number },
) {
  const name = input.name.trim();
  if (!name) {
    throw new AppError(400, "INVALID_INPUT", "名称不能为空");
  }
  try {
    const [created] = await db
      .insert(categories)
      .values({
        name,
        normalizedName: normalizeName(name),
        slug: await slugFor(name),
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    return created;
  } catch (error) {
    if (isUnique(error)) {
      throw conflict("分类名称已存在");
    }
    throw error;
  }
}

export async function updateCategory(
  db: Database,
  id: string,
  input: { name?: string; sortOrder?: number },
) {
  const name = input.name?.trim();
  const [updated] = await db
    .update(categories)
    .set({
      ...(name ? { name, normalizedName: normalizeName(name) } : {}),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    })
    .where(eq(categories.id, id))
    .returning();
  if (!updated) {
    throw new AppError(404, "NOT_FOUND", "分类不存在");
  }
  return updated;
}

export async function deleteCategory(db: Database, id: string) {
  const [used] = await db
    .select({ id: prompts.id })
    .from(prompts)
    .where(eq(prompts.categoryId, id))
    .limit(1);
  if (used) {
    throw referenced();
  }
  const deleted = await db.delete(categories).where(eq(categories.id, id)).returning();
  if (deleted.length === 0) {
    throw new AppError(404, "NOT_FOUND", "分类不存在");
  }
}

export async function createTag(db: Database, nameInput: string) {
  const name = nameInput.trim();
  if (!name) {
    throw new AppError(400, "INVALID_INPUT", "名称不能为空");
  }
  try {
    const [created] = await db
      .insert(tags)
      .values({
        name,
        normalizedName: normalizeName(name),
        slug: await slugFor(name),
      })
      .returning();
    return created;
  } catch (error) {
    if (isUnique(error)) {
      throw conflict("标签名称已存在");
    }
    throw error;
  }
}

export async function updateTag(db: Database, id: string, nameInput: string) {
  const name = nameInput.trim();
  if (!name) {
    throw new AppError(400, "INVALID_INPUT", "名称不能为空");
  }
  try {
    const [updated] = await db
      .update(tags)
      .set({ name, normalizedName: normalizeName(name) })
      .where(eq(tags.id, id))
      .returning();
    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "标签不存在");
    }
    return updated;
  } catch (error) {
    if (isUnique(error)) {
      throw conflict("标签名称已存在");
    }
    throw error;
  }
}

export async function deleteTag(db: Database, id: string) {
  const deleted = await db.delete(tags).where(eq(tags.id, id)).returning();
  if (deleted.length === 0) {
    throw new AppError(404, "NOT_FOUND", "标签不存在");
  }
}

export async function createModel(
  db: Database,
  input: { name: string; description?: string | null; sortOrder?: number },
) {
  const name = input.name.trim();
  if (!name) {
    throw new AppError(400, "INVALID_INPUT", "名称不能为空");
  }
  try {
    const [created] = await db
      .insert(models)
      .values({
        name,
        normalizedName: normalizeName(name),
        slug: await slugFor(name),
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        active: true,
      })
      .returning();
    return created;
  } catch (error) {
    if (isUnique(error)) {
      throw conflict("模型名称已存在");
    }
    throw error;
  }
}

export async function updateModel(
  db: Database,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    sortOrder?: number;
    active?: boolean;
  },
) {
  const name = input.name?.trim();
  try {
    const [updated] = await db
      .update(models)
      .set({
        ...(name ? { name, normalizedName: normalizeName(name) } : {}),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(input.active === undefined ? {} : { active: input.active }),
      })
      .where(eq(models.id, id))
      .returning();
    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "模型不存在");
    }
    return updated;
  } catch (error) {
    if (isUnique(error)) {
      throw conflict("模型名称已存在");
    }
    throw error;
  }
}

export async function deleteModel(db: Database, id: string) {
  const [used] = await db
    .select({ id: prompts.id })
    .from(prompts)
    .where(eq(prompts.modelId, id))
    .limit(1);
  if (used) {
    throw referenced();
  }
  const deleted = await db.delete(models).where(eq(models.id, id)).returning();
  if (deleted.length === 0) {
    throw new AppError(404, "NOT_FOUND", "模型不存在");
  }
}

function isUnique(error: unknown): boolean {
  return sqlState(error) === "23505";
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

export async function taxonomyInUse(db: Database, kind: "category" | "model", id: string) {
  const column = kind === "category" ? prompts.categoryId : prompts.modelId;
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(prompts)
    .where(eq(column, id));
  return Number(row?.value ?? 0) > 0;
}
