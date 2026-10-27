import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { JOB_LEASE_MS, JOB_MAX_ATTEMPTS } from "@/shared/constants";
import type { Database } from "@/server/db/client";
import { jobs } from "@/server/db/schema";

export type ClaimedJob = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  leaseToken: string;
};

const retryDelaysMs = [10_000, 60_000, 300_000];

export function retryDelayMs(attempts: number): number | null {
  if (attempts >= JOB_MAX_ATTEMPTS) {
    return null;
  }
  return retryDelaysMs[attempts - 1] ?? retryDelaysMs[0] ?? null;
}

export async function enqueueJob(
  db: Database,
  input: { type: string; dedupeKey: string; payload: Record<string, unknown>; runAt?: Date },
): Promise<void> {
  await db
    .insert(jobs)
    .values({
      type: input.type,
      dedupeKey: input.dedupeKey,
      payload: input.payload,
      status: "queued",
      runAt: input.runAt ?? new Date(),
    })
    .onConflictDoNothing({ target: jobs.dedupeKey });
}

export async function claimJob(
  db: Database,
  now = new Date(),
): Promise<ClaimedJob | null> {
  const leaseToken = randomBytes(16).toString("hex");
  const lockedUntil = new Date(now.getTime() + JOB_LEASE_MS);
  const result = await db.execute<{
    id: string;
    type: string;
    payload: Record<string, unknown>;
    attempts: number;
    lease_token: string;
  }>(sql`
    update jobs
    set status = 'running',
        attempts = attempts + 1,
        locked_until = ${lockedUntil},
        lease_token = ${leaseToken}
    where id = (
      select id from jobs
      where status in ('queued', 'running')
        and run_at <= ${now}
        and (locked_until is null or locked_until < ${now})
        and attempts < ${JOB_MAX_ATTEMPTS}
      order by run_at, id
      for update skip locked
      limit 1
    )
    returning id, type, payload, attempts, lease_token
  `);
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    attempts: row.attempts,
    leaseToken: row.lease_token,
  };
}

export async function renewJobLease(
  db: Database,
  jobId: string,
  leaseToken: string,
  now = new Date(),
): Promise<boolean> {
  const updated = await db
    .update(jobs)
    .set({ lockedUntil: new Date(now.getTime() + JOB_LEASE_MS) })
    .where(and(eq(jobs.id, jobId), eq(jobs.leaseToken, leaseToken)))
    .returning({ id: jobs.id });
  return updated.length > 0;
}

export async function completeJob(
  db: Database,
  jobId: string,
  leaseToken: string,
): Promise<boolean> {
  const updated = await db
    .update(jobs)
    .set({ status: "done", lockedUntil: null, leaseToken: null, lastError: null })
    .where(and(eq(jobs.id, jobId), eq(jobs.leaseToken, leaseToken)))
    .returning({ id: jobs.id });
  return updated.length > 0;
}

export async function failJob(
  db: Database,
  input: {
    jobId: string;
    leaseToken: string;
    attempts: number;
    message: string;
    retryable: boolean;
    now?: Date;
  },
): Promise<"queued" | "failed" | "lost"> {
  const now = input.now ?? new Date();
  const delay = input.retryable ? retryDelayMs(input.attempts) : null;
  const updated = await db
    .update(jobs)
    .set(
      delay === null
        ? {
            status: "failed",
            lastError: input.message,
            lockedUntil: null,
            leaseToken: null,
          }
        : {
            status: "queued",
            runAt: new Date(now.getTime() + delay),
            lastError: input.message,
            lockedUntil: null,
            leaseToken: null,
          },
    )
    .where(and(eq(jobs.id, input.jobId), eq(jobs.leaseToken, input.leaseToken)))
    .returning({ id: jobs.id });
  if (updated.length === 0) {
    return "lost";
  }
  return delay === null ? "failed" : "queued";
}

export async function requeueFailedJob(db: Database, dedupeKey: string): Promise<boolean> {
  const updated = await db
    .update(jobs)
    .set({
      status: "queued",
      attempts: 0,
      runAt: new Date(),
      lockedUntil: null,
      leaseToken: null,
      lastError: null,
    })
    .where(and(eq(jobs.dedupeKey, dedupeKey), eq(jobs.status, "failed")))
    .returning({ id: jobs.id });
  return updated.length > 0;
}
