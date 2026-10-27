import { z } from "zod";
import {
  deleteCollection,
  getAdminCollection,
  updateCollection,
} from "@/features/collections/server/service";
import { adminRead, adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  version: z.number().int().positive(),
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
  coverAssetId: z.uuid().nullable().optional(),
  promptIds: z.array(z.uuid()).max(200).optional(),
});

type Context = { params: Promise<{ id: string }> };

export function GET(request: Request, context: Context) {
  return adminRead(request, async () => getAdminCollection(getDatabase(), (await context.params).id));
}

export function PATCH(request: Request, context: Context) {
  return adminWrite(request, async () =>
    updateCollection(getDatabase(), (await context.params).id, patchSchema.parse(await readJson(request))),
  );
}

export function DELETE(request: Request, context: Context) {
  return adminWrite(request, async () => {
    await deleteCollection(getDatabase(), (await context.params).id);
    return { ok: true };
  });
}
