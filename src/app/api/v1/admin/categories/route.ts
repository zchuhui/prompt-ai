import { z } from "zod";
import { createCategory, listAdminTaxonomies } from "@/features/taxonomies/server/service";
import { adminRead, adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  sortOrder: z.number().int().optional(),
});

export function GET(request: Request) {
  return adminRead(request, async () => (await listAdminTaxonomies(getDatabase())).categories);
}

export function POST(request: Request) {
  return adminWrite(request, async () =>
    createCategory(getDatabase(), createSchema.parse(await readJson(request))),
  );
}
