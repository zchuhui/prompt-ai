import { listPublicCollections } from "@/features/collections/server/service";
import { publicRead } from "@/server/api";
import { getDatabase } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return publicRead(() => listPublicCollections(getDatabase()));
}
