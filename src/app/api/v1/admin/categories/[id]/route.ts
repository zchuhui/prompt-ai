import { z } from "zod";
import { deleteCategory, updateCategory } from "@/features/taxonomies/server/service";
import { adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  sortOrder: z.number().int().optional(),
});

type Context = { params: Promise<{ id: string }> };

export function PATCH(request: Request, context: Context) {
  return adminWrite(request, async () =>
    updateCategory(getDatabase(), (await context.params).id, patchSchema.parse(await readJson(request))),
  );
}

export function DELETE(request: Request, context: Context) {
  return adminWrite(request, async () => {
    await deleteCategory(getDatabase(), (await context.params).id);
    return { ok: true };
  });
}
