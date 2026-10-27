import { assertSameOrigin } from "@/features/auth/server/guards";
import { recordEvent } from "@/features/analytics/server/service";
import { clientIp } from "@/server/auth/tokens";
import { publicWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { AppError } from "@/shared/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return publicWrite(async () => {
    assertSameOrigin(request);
    const rawBody = await request.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new AppError(400, "INVALID_INPUT", "事件不合法");
    }
    await recordEvent(getDatabase(), {
      rawBody,
      ip: clientIp(request),
      secret: getEnv().RATE_LIMIT_SECRET,
      body,
    });
    return new Response(null, { status: 202, headers: { "cache-control": "no-store" } });
  });
}
