import { sql } from "drizzle-orm";
import { AppError } from "@/shared/errors";
import { getDatabase } from "@/server/db/client";
import { jsonData, requestId, toErrorResponse } from "@/server/http";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const id = requestId();
  try {
    await getDatabase().execute(sql`select 1`);
    await getStorage().ready();
    return jsonData({ status: "ok" });
  } catch {
    return toErrorResponse(new AppError(503, "UNAVAILABLE", "依赖不可用"), id);
  }
}
