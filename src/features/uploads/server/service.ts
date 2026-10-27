import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { AppError } from "@/shared/errors";
import { UPLOAD_MAX_BYTES, UPLOAD_SINGLE_MAX_ITEMS } from "@/shared/constants";
import { readLimitedBody, sha256 } from "@/server/body";
import type { Database } from "@/server/db/client";
import { assets, uploadBatches, uploadItems } from "@/server/db/schema";
import { requestHash, withIdempotency } from "@/server/idempotency";
import { enqueueJob, requeueFailedJob } from "@/server/jobs";
import type { ObjectStorage } from "@/server/storage";
import { createEmptyPrompt } from "@/features/prompts/server/service";
import type { UploadBatchInput } from "@/features/prompts/schemas";

function uploadError(status: number, code: string, message: string): AppError {
  return new AppError(status, code, message);
}

export async function createUploadBatch(
  db: Database,
  input: {
    adminId: string;
    requestId: string;
    idempotencyKey: string | null;
    rawBody: string;
    body: UploadBatchInput;
  },
) {
  if (input.body.mode === "single" && input.body.items.length > UPLOAD_SINGLE_MAX_ITEMS) {
    throw uploadError(400, "INVALID_INPUT", "单条内容最多 20 张图片");
  }
  if (input.body.mode === "multiple" && input.body.targetPromptId) {
    throw uploadError(400, "INVALID_INPUT", "每张图片独立草稿时不能指定已有内容");
  }
  const ids = new Set(input.body.items.map((item) => item.clientItemId));
  if (ids.size !== input.body.items.length) {
    throw uploadError(400, "INVALID_INPUT", "上传条目标识重复");
  }
  if (input.body.items.some((item) => item.size > UPLOAD_MAX_BYTES)) {
    throw uploadError(413, "PAYLOAD_TOO_LARGE", "文件超过 20 MiB");
  }

  return withIdempotency(
    db,
    {
      adminId: input.adminId,
      key: input.idempotencyKey,
      hash: requestHash("/api/v1/admin/upload-batches", input.rawBody),
    },
    async () => {
      const defaults = input.body.defaults ?? {};
      return db.transaction(async (tx) => {
        let sharedPromptId = input.body.targetPromptId ?? null;
        if (sharedPromptId) {
          const [prompt] = await tx.execute<{ id: string }>(
            sql`select id from prompts where id = ${sharedPromptId} and deleted_at is null for update`,
          ).then((result) => result.rows);
          if (!prompt) {
            throw uploadError(404, "NOT_FOUND", "草稿不存在");
          }
        } else if (input.body.mode === "single") {
          const created = await createEmptyPrompt(tx as unknown as Database, {
            categoryId: defaults.categoryId,
            modelId: defaults.modelId,
            tagIds: defaults.tagIds,
            adminId: input.adminId,
            requestId: input.requestId,
          });
          sharedPromptId = created.id;
        }

        const [batch] = await tx
          .insert(uploadBatches)
          .values({
            mode: input.body.mode,
            defaults,
            adminId: input.adminId,
            targetPromptId: input.body.targetPromptId ?? null,
          })
          .returning({ id: uploadBatches.id });
        if (!batch) {
          throw uploadError(500, "INTERNAL", "无法创建上传批次");
        }

        const items = [];
        for (const [index, item] of input.body.items.entries()) {
          let promptId = sharedPromptId;
          if (input.body.mode === "multiple") {
            const created = await createEmptyPrompt(tx as unknown as Database, {
              categoryId: defaults.categoryId,
              modelId: defaults.modelId,
              tagIds: defaults.tagIds,
              adminId: input.adminId,
              requestId: input.requestId,
            });
            promptId = created.id;
          }
          const [createdItem] = await tx
            .insert(uploadItems)
            .values({
              batchId: batch.id,
              clientItemId: item.clientItemId,
              promptId,
              position: index,
              declaredSize: item.size,
              declaredType: item.type,
              fileName: item.name,
              status: "pending",
            })
            .returning({
              id: uploadItems.id,
              clientItemId: uploadItems.clientItemId,
              promptId: uploadItems.promptId,
              status: uploadItems.status,
            });
          if (!createdItem) {
            throw uploadError(500, "INTERNAL", "无法创建上传条目");
          }
          items.push(createdItem);
        }
        return { batchId: batch.id, items };
      });
    },
  );
}

export async function getUploadBatch(db: Database, adminId: string, batchId: string) {
  const [batch] = await db
    .select()
    .from(uploadBatches)
    .where(and(eq(uploadBatches.id, batchId), eq(uploadBatches.adminId, adminId)))
    .limit(1);
  if (!batch) {
    throw uploadError(404, "NOT_FOUND", "上传批次不存在");
  }
  const items = await db
    .select({
      id: uploadItems.id,
      clientItemId: uploadItems.clientItemId,
      promptId: uploadItems.promptId,
      assetId: uploadItems.assetId,
      status: uploadItems.status,
      errorCode: uploadItems.errorCode,
      position: uploadItems.position,
      declaredSize: uploadItems.declaredSize,
      fileName: uploadItems.fileName,
      checksum: assets.checksum,
    })
    .from(uploadItems)
    .leftJoin(assets, eq(assets.id, uploadItems.assetId))
    .where(eq(uploadItems.batchId, batchId))
    .orderBy(asc(uploadItems.position));
  return {
    id: batch.id,
    mode: batch.mode,
    targetPromptId: batch.targetPromptId,
    items,
  };
}

export async function receiveUploadFile(
  db: Database,
  storage: ObjectStorage,
  input: { adminId: string; itemId: string; request: Request },
) {
  const [owned] = await db
    .select({
      itemId: uploadItems.id,
      status: uploadItems.status,
      assetId: uploadItems.assetId,
      declaredSize: uploadItems.declaredSize,
      errorCode: uploadItems.errorCode,
      batchAdminId: uploadBatches.adminId,
    })
    .from(uploadItems)
    .innerJoin(uploadBatches, eq(uploadBatches.id, uploadItems.batchId))
    .where(eq(uploadItems.id, input.itemId))
    .limit(1);
  if (!owned || owned.batchAdminId !== input.adminId) {
    throw uploadError(404, "NOT_FOUND", "上传条目不存在");
  }
  if (owned.status === "ready" || owned.status === "processing" || owned.assetId) {
    if (owned.status === "failed") {
      throw uploadError(409, "USE_RETRY", "处理失败的图片请使用重试");
    }
    return { id: owned.itemId, status: owned.status, assetId: owned.assetId };
  }

  const bytes = await readLimitedBody(input.request, UPLOAD_MAX_BYTES);
  if (bytes.byteLength !== owned.declaredSize) {
    throw uploadError(400, "INVALID_INPUT", "文件大小与声明不一致");
  }
  const checksum = sha256(bytes);
  const declaredChecksum = input.request.headers.get("x-content-sha256");
  if (declaredChecksum && declaredChecksum !== checksum) {
    throw uploadError(400, "INVALID_INPUT", "文件校验和不匹配");
  }
  const tempKey = `tmp/${crypto.randomUUID()}`;
  await storage.put(tempKey, bytes, "application/octet-stream");
  let saved: {
    id: string;
    status: string;
    assetId: string | null;
    stored: boolean;
  };
  try {
    saved = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: uploadItems.id, status: uploadItems.status, assetId: uploadItems.assetId })
        .from(uploadItems)
        .where(eq(uploadItems.id, input.itemId))
        .for("update")
        .limit(1);
      if (!locked) {
        throw uploadError(404, "NOT_FOUND", "上传条目不存在");
      }
      if (locked.assetId || locked.status === "ready" || locked.status === "processing") {
        return {
          id: locked.id,
          status: locked.status,
          assetId: locked.assetId,
          stored: false,
        };
      }
      const [asset] = await tx
        .insert(assets)
        .values({
          status: "queued",
          sourceKey: tempKey,
          checksum,
          byteSize: bytes.byteLength,
        })
        .returning({ id: assets.id });
      if (!asset) {
        throw uploadError(500, "INTERNAL", "无法保存图片");
      }
      await tx
        .update(uploadItems)
        .set({ assetId: asset.id, status: "processing", errorCode: null })
        .where(eq(uploadItems.id, locked.id));
      await enqueueJob(tx as unknown as Database, {
        type: "process-image",
        dedupeKey: `process-image:${asset.id}`,
        payload: { assetId: asset.id, uploadItemId: locked.id },
      });
      return {
        id: locked.id,
        status: "processing" as const,
        assetId: asset.id,
        stored: true,
      };
    });
  } catch (error) {
    await storage.delete(tempKey);
    throw error;
  }
  if (!saved.stored) {
    await storage.delete(tempKey);
  }
  return { id: saved.id, status: saved.status, assetId: saved.assetId };
}

export async function retryUploadItem(
  db: Database,
  input: { adminId: string; itemId: string },
) {
  const [item] = await db
    .select({
      id: uploadItems.id,
      status: uploadItems.status,
      assetId: uploadItems.assetId,
      adminId: uploadBatches.adminId,
    })
    .from(uploadItems)
    .innerJoin(uploadBatches, eq(uploadBatches.id, uploadItems.batchId))
    .where(eq(uploadItems.id, input.itemId))
    .limit(1);
  if (!item || item.adminId !== input.adminId || !item.assetId) {
    throw uploadError(404, "NOT_FOUND", "上传条目不存在");
  }
  if (item.status !== "failed") {
    throw uploadError(409, "CONFLICT", "只有处理失败的图片可以重试");
  }
  const requeued = await requeueFailedJob(db, `process-image:${item.assetId}`);
  if (!requeued) {
    throw uploadError(409, "CONFLICT", "没有可重试的处理任务");
  }
  await db.update(assets).set({ status: "queued", errorCode: null }).where(eq(assets.id, item.assetId));
  await db
    .update(uploadItems)
    .set({ status: "processing", errorCode: null })
    .where(eq(uploadItems.id, item.id));
  return { id: item.id, status: "processing" as const, assetId: item.assetId };
}
