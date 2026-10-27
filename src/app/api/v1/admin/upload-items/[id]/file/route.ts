import { jsonData } from "@/server/http";
import { receiveUploadFile } from "@/features/uploads/server/service";
import { adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { getProcessEnv } from "@/server/env-core";
import { runClaimedJobs } from "@/server/job-runner";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminWrite(request, async (admin) => {
    const saved = await receiveUploadFile(getDatabase(), getStorage(), {
      adminId: admin.adminId,
      itemId: (await context.params).id,
      request,
    });
    if (getProcessEnv().STORAGE_DRIVER === "memory") {
      await runClaimedJobs(10);
    }
    return jsonData(saved, saved.status === "processing" ? 202 : 200);
  });
}
