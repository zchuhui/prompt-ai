import { z } from "zod";
import { publishPrompt } from "@/features/prompts/server/service";
import { adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const versionSchema = z.object({ version: z.number().int().positive() });

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminWrite(request, async (admin, requestId) => {
    const body = versionSchema.parse(await readJson(request));
    return publishPrompt(getDatabase(), (await context.params).id, body.version, {
      adminId: admin.adminId,
      requestId,
    });
  });
}
