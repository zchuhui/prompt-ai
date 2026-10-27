import { readRequestAdmin } from "@/features/auth/server/guards";
import { AppError } from "@/shared/errors";
import { jsonData, requestId, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const id = requestId();
  try {
    const admin = await readRequestAdmin(request);
    if (!admin) {
      throw new AppError(401, "UNAUTHORIZED", "需要登录");
    }
    return jsonData({ username: admin.username, csrfToken: admin.csrfToken });
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
