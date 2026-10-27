import { z } from "zod";
import { promptPatchSchema } from "@/features/prompts/schemas";
import {
  deletePrompt,
  getAdminPrompt,
  updatePrompt,
} from "@/features/prompts/server/service";
import { adminRead, adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const versionSchema = z.object({ version: z.number().int().positive() });

type Context = { params: Promise<{ id: string }> };

export function GET(request: Request, context: Context) {
  return adminRead(request, async () => getAdminPrompt(getDatabase(), (await context.params).id));
}

export function PATCH(request: Request, context: Context) {
  return adminWrite(request, async (admin, requestId) => {
    const patch = promptPatchSchema.parse(await readJson(request));
    return updatePrompt(getDatabase(), (await context.params).id, patch, {
      adminId: admin.adminId,
      requestId,
    });
  });
}

export function DELETE(request: Request, context: Context) {
  return adminWrite(request, async (admin, requestId) => {
    const body = versionSchema.parse(await readJson(request));
    return deletePrompt(getDatabase(), (await context.params).id, body.version, {
      adminId: admin.adminId,
      requestId,
    });
  });
}
