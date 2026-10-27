import { JOB_RENEW_MS } from "@/shared/constants";
import { getDatabase } from "@/server/db/client";
import { cleanupExpiredData, processImageJob } from "@/server/images/process";
import {
  claimJob,
  completeJob,
  enqueueJob,
  failJob,
  renewJobLease,
  type ClaimedJob,
} from "@/server/jobs";
import { log } from "@/server/logger";
import { getStorage } from "@/server/storage";
import { getProcessEnv } from "@/server/env-core";

export async function runClaimedJobs(limit = 20): Promise<number> {
  const db = getDatabase();
  const storage = getStorage();
  let ran = 0;
  for (let index = 0; index < limit; index += 1) {
    const job = await claimJob(db);
    if (!job) {
      break;
    }
    ran += 1;
    await dispatchJob(db, storage, job);
  }
  return ran;
}

async function dispatchJob(
  db: ReturnType<typeof getDatabase>,
  storage: ReturnType<typeof getStorage>,
  job: ClaimedJob,
): Promise<void> {
  const renew = setInterval(() => {
    void renewJobLease(db, job.id, job.leaseToken);
  }, JOB_RENEW_MS);
  try {
    if (job.type === "process-image") {
      await processImageJob(db, storage, job);
      return;
    }
    if (job.type === "cleanup") {
      await cleanupExpiredData(db, storage);
      await completeJob(db, job.id, job.leaseToken);
    }
  } catch (error) {
    log("error", "job failed", { jobId: job.id });
    await failJob(db, {
      jobId: job.id,
      leaseToken: job.leaseToken,
      attempts: job.attempts,
      message: error instanceof Error ? error.name : "job",
      retryable: true,
    });
  } finally {
    clearInterval(renew);
  }
}

const globalPump = globalThis as typeof globalThis & {
  promptGalleryJobPump?: boolean;
};

export function startMemoryJobPump(): void {
  if (getProcessEnv().STORAGE_DRIVER !== "memory" || globalPump.promptGalleryJobPump) {
    return;
  }
  globalPump.promptGalleryJobPump = true;
  const timer = setInterval(() => {
    void runClaimedJobs(5).catch(() => {
      log("error", "memory job pump failed");
    });
  }, 400);
  timer.unref?.();
}

export async function ensureDailyCleanup(): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  await enqueueJob(getDatabase(), {
    type: "cleanup",
    dedupeKey: `cleanup:${day}`,
    payload: {},
  });
}
