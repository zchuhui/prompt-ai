import { retryUploadItem } from "@/features/uploads/server/service";
import { adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { getProcessEnv } from "@/server/env-core";
import { runClaimedJobs } from "@/server/job-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminWrite(request, async (admin) => {
    const result = await retryUploadItem(getDatabase(), {
      adminId: admin.adminId,
      itemId: (await context.params).id,
    });
    if (getProcessEnv().STORAGE_DRIVER === "memory") {
      await runClaimedJobs(10);
    }
    return result;
  });
}
