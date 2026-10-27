import { batchPromptSchema } from "@/features/prompts/schemas";
import { batchPrompts } from "@/features/prompts/server/service";
import { adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return adminWrite(request, async (admin, requestId) => {
    const body = batchPromptSchema.parse(await readJson(request));
    return batchPrompts(getDatabase(), body.action, body.items, {
      adminId: admin.adminId,
      requestId,
    });
  });
}
