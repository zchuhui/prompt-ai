import { z } from "zod";
import { deleteTag, updateTag } from "@/features/taxonomies/server/service";
import { adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export function PATCH(request: Request, context: Context) {
  return adminWrite(request, async () => {
    const body = z.object({ name: z.string().min(1).max(80) }).parse(await readJson(request));
    return updateTag(getDatabase(), (await context.params).id, body.name);
  });
}

export function DELETE(request: Request, context: Context) {
  return adminWrite(request, async () => {
    await deleteTag(getDatabase(), (await context.params).id);
    return { ok: true };
  });
}
