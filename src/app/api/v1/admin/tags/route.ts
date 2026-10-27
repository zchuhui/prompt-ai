import { z } from "zod";
import { createTag, listAdminTaxonomies } from "@/features/taxonomies/server/service";
import { adminRead, adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return adminRead(request, async () => (await listAdminTaxonomies(getDatabase())).tags);
}

export function POST(request: Request) {
  return adminWrite(request, async () => {
    const body = z.object({ name: z.string().min(1).max(80) }).parse(await readJson(request));
    return createTag(getDatabase(), body.name);
  });
}
