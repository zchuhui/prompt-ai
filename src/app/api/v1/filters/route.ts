import { listFilters } from "@/features/prompts/server/queries";
import { publicRead } from "@/server/api";
import { getDatabase } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return publicRead(() => listFilters(getDatabase()));
}
