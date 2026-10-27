import { JOB_RENEW_MS } from "@/shared/constants";
import { createDatabase, createPool } from "@/server/db/client";
import { getProcessEnv } from "@/server/env-core";
import { cleanupExpiredData, processImageJob } from "@/server/images/process";
import { claimJob, completeJob, enqueueJob, failJob, renewJobLease } from "@/server/jobs";
import { loadLocalEnv } from "@/server/load-env";
import { log } from "@/server/logger";
import { getStorage } from "@/server/storage";

async function workerLoop(signal: AbortSignal): Promise<void> {
  loadLocalEnv();
  const env = getProcessEnv();
  const pool = createPool(env.DATABASE_URL);
  const db = createDatabase(pool);
  const storage = getStorage();

  const scheduleCleanup = async () => {
    const day = new Date().toISOString().slice(0, 10);
    await enqueueJob(db, {
      type: "cleanup",
      dedupeKey: `cleanup:${day}`,
      payload: {},
    });
  };
  await scheduleCleanup();
  const cleanupTimer = setInterval(() => {
    void scheduleCleanup().catch(() => {
      log("warn", "cleanup schedule failed");
    });
  }, 60 * 60 * 1000);

  async function loop(): Promise<void> {
    while (!signal.aborted) {
      const job = await claimJob(db);
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      const renew = setInterval(() => {
        void renewJobLease(db, job.id, job.leaseToken);
      }, JOB_RENEW_MS);
      try {
        if (job.type === "process-image") {
          await processImageJob(db, storage, job);
        } else if (job.type === "cleanup") {
          await cleanupExpiredData(db, storage);
          await completeJob(db, job.id, job.leaseToken);
        }
      } catch (error) {
        log("error", "worker job failed", { jobId: job.id });
        await failJob(db, {
          jobId: job.id,
          leaseToken: job.leaseToken,
          attempts: job.attempts,
          message: error instanceof Error ? error.name : "worker",
          retryable: true,
        });
      } finally {
        clearInterval(renew);
      }
    }
  }

  try {
    await Promise.all(
      Array.from({ length: env.WORKER_CONCURRENCY }, () => loop()),
    );
  } finally {
    clearInterval(cleanupTimer);
    await pool.end();
  }
}

const controller = new AbortController();
process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());
workerLoop(controller.signal).catch((error: unknown) => {
  log("error", "worker stopped", {
    reason: error instanceof Error ? error.name : "error",
  });
  process.exitCode = 1;
});
