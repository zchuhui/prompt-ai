import { duplicatePrompt } from "@/features/prompts/server/service";
import { adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminWrite(request, async (admin, requestId) =>
    duplicatePrompt(getDatabase(), (await context.params).id, {
      adminId: admin.adminId,
      requestId,
    }),
  );
}
