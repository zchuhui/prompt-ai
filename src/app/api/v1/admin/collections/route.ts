import {
  createCollection,
  listAdminCollections,
} from "@/features/collections/server/service";
import { adminRead, adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { readJson } from "@/server/http";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return adminRead(request, () => listAdminCollections(getDatabase()));
}

export function POST(request: Request) {
  return adminWrite(request, async () => {
    const body = z
      .object({
        title: z.string().min(1).max(120),
        description: z.string().max(2000).nullable().optional(),
      })
      .parse(await readJson(request));
    return createCollection(getDatabase(), body);
  });
}
