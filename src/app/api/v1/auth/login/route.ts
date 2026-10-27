import { loginSchema } from "@/features/auth/schemas";
import {
  requestClientIp,
  assertSameOrigin,
  withSessionCookie,
} from "@/features/auth/server/guards";
import { loginAdmin } from "@/features/auth/server/service";
import { getDatabase } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { jsonData, readJson, requestId, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const id = requestId();
  try {
    assertSameOrigin(request);
    const input = loginSchema.parse(await readJson(request));
    const env = getEnv();
    const admin = await loginAdmin(getDatabase(), {
      username: input.username,
      password: input.password,
      ip: requestClientIp(request),
      rateLimitSecret: env.RATE_LIMIT_SECRET,
      csrfSecret: env.CSRF_SECRET,
      requestId: id,
    });
    return withSessionCookie(
      jsonData({ username: admin.username, csrfToken: admin.csrfToken }),
      admin.token,
    );
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
