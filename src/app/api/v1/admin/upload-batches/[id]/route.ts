import { getUploadBatch } from "@/features/uploads/server/service";
import { adminRead } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { getProcessEnv } from "@/server/env-core";
import { runClaimedJobs } from "@/server/job-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminRead(request, async (admin) => {
    if (getProcessEnv().STORAGE_DRIVER === "memory") {
      await runClaimedJobs(10);
    }
    return getUploadBatch(getDatabase(), admin.adminId, (await context.params).id);
  });
}
