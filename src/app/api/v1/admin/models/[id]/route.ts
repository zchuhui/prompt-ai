import { z } from "zod";
import { deleteModel, updateModel } from "@/features/taxonomies/server/service";
import { adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

type Context = { params: Promise<{ id: string }> };

export function PATCH(request: Request, context: Context) {
  return adminWrite(request, async () =>
    updateModel(getDatabase(), (await context.params).id, schema.parse(await readJson(request))),
  );
}

export function DELETE(request: Request, context: Context) {
  return adminWrite(request, async () => {
    await deleteModel(getDatabase(), (await context.params).id);
    return { ok: true };
  });
}
