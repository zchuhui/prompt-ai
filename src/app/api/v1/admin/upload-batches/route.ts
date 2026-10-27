import { uploadBatchSchema } from "@/features/prompts/schemas";
import { createUploadBatch } from "@/features/uploads/server/service";
import { AppError } from "@/shared/errors";
import { adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return adminWrite(request, async (admin, requestId) => {
    const rawBody = await request.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new AppError(400, "INVALID_INPUT", "输入不合法");
    }
    const body = uploadBatchSchema.parse(parsed);
    return createUploadBatch(getDatabase(), {
      adminId: admin.adminId,
      requestId,
      idempotencyKey: request.headers.get("idempotency-key"),
      rawBody,
      body,
    });
  });
}
