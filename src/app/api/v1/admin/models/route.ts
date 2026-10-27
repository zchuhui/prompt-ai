import { z } from "zod";
import { createModel, listAdminTaxonomies } from "@/features/taxonomies/server/service";
import { adminRead, adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export function GET(request: Request) {
  return adminRead(request, async () => (await listAdminTaxonomies(getDatabase())).models);
}

export function POST(request: Request) {
  return adminWrite(request, async () =>
    createModel(getDatabase(), schema.parse(await readJson(request))),
  );
}
