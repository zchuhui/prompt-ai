import {
  requireAdminMutation,
  withClearedSession,
} from "@/features/auth/server/guards";
import { logoutAdmin } from "@/features/auth/server/service";
import { getDatabase } from "@/server/db/client";
import { jsonData, requestId, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const id = requestId();
  try {
    const admin = await requireAdminMutation(request);
    await logoutAdmin(getDatabase(), { token: admin.token, requestId: id });
    return withClearedSession(jsonData({ ok: true }));
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
