import { and, asc, eq, isNull, notInArray, sql } from "drizzle-orm";
import sharp from "sharp";
import { AppError } from "@/shared/errors";
import {
  CARD_MAX_EDGE,
  DETAIL_MAX_EDGE,
  PIXEL_MAX,
} from "@/shared/constants";
import type { Database } from "@/server/db/client";
import {
  assets,
  jobs,
  promptAssets,
  prompts,
  uploadBatches,
  uploadItems,
} from "@/server/db/schema";
import { failJob } from "@/server/jobs";
import type { ClaimedJob } from "@/server/jobs";
import type { ObjectStorage } from "@/server/storage";

type ImageMeta = {
  format?: string;
  pages?: number;
  width?: number;
  height?: number;
};

export function assertStillImage(meta: ImageMeta): void {
  const frames = meta.pages ?? 1;
  if (frames > 1) {
    throw new AppError(415, "UNSUPPORTED_MEDIA", "不接受动画图片");
  }
  if (meta.format !== "jpeg" && meta.format !== "png" && meta.format !== "webp") {
    throw new AppError(415, "UNSUPPORTED_MEDIA", "只接受 JPEG、PNG 和 WebP");
  }
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 1 || height < 1 || width * height > PIXEL_MAX) {
    throw new AppError(422, "IMAGE_LIMIT", "图片尺寸无效或超过 4000 万像素");
  }
}

export type RenderedImage = {
  original: Buffer;
  card: Buffer;
  detail: Buffer;
  width: number;
  height: number;
};

export async function renderVariants(input: Buffer): Promise<RenderedImage> {
  try {
    const meta = await sharp(input, {
      failOn: "error",
      animated: false,
      limitInputPixels: PIXEL_MAX,
    }).metadata();
    assertStillImage(meta);
    const original = await sharp(input, {
      failOn: "error",
      animated: false,
      limitInputPixels: PIXEL_MAX,
    })
      .rotate()
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const card = await sharp(original.data)
      .resize({
        width: CARD_MAX_EDGE,
        height: CARD_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    const detail = await sharp(original.data)
      .resize({
        width: DETAIL_MAX_EDGE,
        height: DETAIL_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    return {
      original: original.data,
      card,
      detail,
      width: original.info.width,
      height: original.info.height,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(415, "UNSUPPORTED_MEDIA", "图片无法解码");
  }
}

function variantKey(assetId: string, name: "original" | "card" | "detail"): string {
  return `public/${assetId}/v1/${name}.webp`;
}

function permanent(error: unknown): boolean {
  return (
    error instanceof AppError &&
    (error.code === "UNSUPPORTED_MEDIA" || error.code === "IMAGE_LIMIT")
  );
}

export async function processImageJob(
  db: Database,
  storage: ObjectStorage,
  job: ClaimedJob,
): Promise<void> {
  const assetId = String(job.payload.assetId ?? "");
  const uploadItemId = String(job.payload.uploadItemId ?? "");
  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!asset) {
    await failJob(db, {
      jobId: job.id,
      leaseToken: job.leaseToken,
      attempts: job.attempts,
      message: "缺少图片记录",
      retryable: false,
    });
    return;
  }

  try {
    const source = await storage.get(asset.sourceKey);
    const rendered = await renderVariants(Buffer.from(source));
    const originalKey = variantKey(asset.id, "original");
    const cardKey = variantKey(asset.id, "card");
    const detailKey = variantKey(asset.id, "detail");
    await storage.put(originalKey, rendered.original, "image/webp");
    await storage.put(cardKey, rendered.card, "image/webp");
    await storage.put(detailKey, rendered.detail, "image/webp");

    const applied = await db.transaction(async (tx) => {
      const finished = await tx
        .update(jobs)
        .set({
          status: "done",
          lockedUntil: null,
          leaseToken: null,
          lastError: null,
        })
        .where(and(eq(jobs.id, job.id), eq(jobs.leaseToken, job.leaseToken)))
        .returning({ id: jobs.id });
      if (finished.length === 0) {
        return false;
      }
      await tx
        .update(assets)
        .set({
          status: "ready",
          originalKey,
          cardKey,
          detailKey,
          mimeType: "image/webp",
          width: rendered.width,
          height: rendered.height,
          errorCode: null,
          readyAt: new Date(),
        })
        .where(eq(assets.id, asset.id));
      await tx
        .update(uploadItems)
        .set({ status: "ready", errorCode: null })
        .where(eq(uploadItems.id, uploadItemId));
      await linkReadyAsset(tx, uploadItemId, asset.id);
      return true;
    });
    if (!applied) {
      return;
    }
  } catch (error) {
    const message = error instanceof AppError ? error.message : "图片处理失败";
    const retryable = !permanent(error);
    await db
      .update(assets)
      .set({
        status: retryable ? "queued" : "failed",
        errorCode: error instanceof AppError ? error.code : "PROCESSING_FAILED",
      })
      .where(eq(assets.id, asset.id));
    await db
      .update(uploadItems)
      .set({
        status: retryable ? "processing" : "failed",
        errorCode: error instanceof AppError ? error.code : "PROCESSING_FAILED",
      })
      .where(eq(uploadItems.id, uploadItemId));
    await failJob(db, {
      jobId: job.id,
      leaseToken: job.leaseToken,
      attempts: job.attempts,
      message,
      retryable,
    });
  }
}

async function linkReadyAsset(
  tx: Database,
  uploadItemId: string,
  assetId: string,
): Promise<void> {
  const [item] = await tx
    .select({
      promptId: uploadItems.promptId,
      position: uploadItems.position,
      fileName: uploadItems.fileName,
      batchId: uploadItems.batchId,
    })
    .from(uploadItems)
    .where(eq(uploadItems.id, uploadItemId))
    .limit(1);
  if (!item?.promptId) {
    return;
  }
  await tx.execute(sql`select id from prompts where id = ${item.promptId} for update`);
  const [batch] = await tx
    .select({ defaults: uploadBatches.defaults })
    .from(uploadBatches)
    .where(eq(uploadBatches.id, item.batchId))
    .limit(1);
  const replace = batch?.defaults.replaceAssets === true;
  if (replace) {
    const batchAssets = await tx
      .select({ assetId: uploadItems.assetId })
      .from(uploadItems)
      .where(eq(uploadItems.batchId, item.batchId));
    const keep = batchAssets.flatMap((row) => (row.assetId ? [row.assetId] : []));
    await tx
      .delete(promptAssets)
      .where(
        and(
          eq(promptAssets.promptId, item.promptId),
          keep.length > 0
            ? notInArray(promptAssets.assetId, keep)
            : sql`true`,
        ),
      );
  }
  const [maxPosition] = await tx
    .select({
      value: sql<number>`coalesce(max(${promptAssets.position}), -1)::int`,
    })
    .from(promptAssets)
    .where(eq(promptAssets.promptId, item.promptId));
  const position = replace
    ? item.position
    : Number(maxPosition?.value ?? -1) + 1 + item.position;
  await tx
    .insert(promptAssets)
    .values({
      promptId: item.promptId,
      assetId,
      position,
      alt: null,
    })
    .onConflictDoNothing();
  const [cover] = await tx
    .select({ assetId: promptAssets.assetId })
    .from(promptAssets)
    .where(eq(promptAssets.promptId, item.promptId))
    .orderBy(asc(promptAssets.position))
    .limit(1);
  const [prompt] = await tx
    .select({ coverAssetId: prompts.coverAssetId })
    .from(prompts)
    .where(eq(prompts.id, item.promptId))
    .limit(1);
  if (cover && (!prompt?.coverAssetId || replace)) {
    const coverStillThere = await tx
      .select({ assetId: promptAssets.assetId })
      .from(promptAssets)
      .where(
        and(
          eq(promptAssets.promptId, item.promptId),
          eq(promptAssets.assetId, prompt?.coverAssetId ?? cover.assetId),
        ),
      )
      .limit(1);
    if (!prompt?.coverAssetId || coverStillThere.length === 0 || replace) {
      await tx
        .update(prompts)
        .set({ coverAssetId: cover.assetId, updatedAt: new Date() })
        .where(eq(prompts.id, item.promptId));
    }
  }
}

export async function cleanupExpiredData(
  db: Database,
  storage: ObjectStorage,
  now = new Date(),
): Promise<void> {
  const day = 24 * 60 * 60 * 1000;
  const temporary = await storage.list("tmp/");
  const referenced = new Set(
    (await db.select({ sourceKey: assets.sourceKey }).from(assets)).map(
      (row) => row.sourceKey,
    ),
  );
  for (const object of temporary) {
    if (
      !referenced.has(object.key) &&
      now.getTime() - object.lastModified.getTime() > day
    ) {
      await storage.delete(object.key);
    }
  }

  const stale = new Date(now.getTime() - 7 * day);
  const candidates = await db
    .select()
    .from(assets)
    .where(and(sql`${assets.createdAt} < ${stale}`, sql`${assets.status} in ('ready', 'failed')`));
  for (const asset of candidates) {
    const [promptUse] = await db
      .select({ id: promptAssets.promptId })
      .from(promptAssets)
      .innerJoin(prompts, eq(prompts.id, promptAssets.promptId))
      .where(and(eq(promptAssets.assetId, asset.id), isNull(prompts.deletedAt)))
      .limit(1);
    const [coverUse] = await db
      .select({ id: prompts.id })
      .from(prompts)
      .where(and(eq(prompts.coverAssetId, asset.id), isNull(prompts.deletedAt)))
      .limit(1);
    if (promptUse || coverUse) {
      continue;
    }
    for (const key of [asset.sourceKey, asset.originalKey, asset.cardKey, asset.detailKey]) {
      if (key) {
        await storage.delete(key);
      }
    }
    await db.delete(assets).where(eq(assets.id, asset.id));
  }

  const oldContent = new Date(now.getTime() - 30 * day);
  await db
    .delete(prompts)
    .where(and(sql`${prompts.deletedAt} is not null`, sql`${prompts.deletedAt} < ${oldContent}`));

  const oldEvents = new Date(now.getTime() - 90 * day);
  await db.execute(sql`delete from analytics_events where created_at < ${oldEvents}`);
  await db.execute(sql`delete from rate_limits where window_start < ${new Date(now.getTime() - day)}`);
  await db.execute(sql`delete from idempotency_keys where expires_at < ${now}`);
}
