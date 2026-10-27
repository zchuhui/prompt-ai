import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST as login } from "../../src/app/api/v1/auth/login/route";
import { GET as readBatch } from "../../src/app/api/v1/admin/upload-batches/[id]/route";
import { POST as createBatch } from "../../src/app/api/v1/admin/upload-batches/route";
import { PUT as uploadFile } from "../../src/app/api/v1/admin/upload-items/[id]/file/route";
import { createInitialAdmin } from "../../src/server/auth/repository";
import { closeDatabase, createDatabase, type Database } from "../../src/server/db/client";
import { admins, assets, jobs, promptAssets, prompts, uploadItems } from "../../src/server/db/schema";
import { resetProcessEnvForTests } from "../../src/server/env-core";
import { claimJob, completeJob, enqueueJob } from "../../src/server/jobs";
import { runClaimedJobs } from "../../src/server/job-runner";
import { loadLocalEnv } from "../../src/server/load-env";
import { MemoryStorage, setStorageForTests, type ObjectStorage } from "../../src/server/storage";
import { receiveUploadFile } from "../../src/features/uploads/server/service";
import { createEmptyPrompt } from "../../src/features/prompts/server/service";
import { UPLOAD_MAX_BYTES } from "../../src/shared/constants";
import { truncateApplicationTables } from "./postgres";

loadLocalEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const origin = process.env.APP_URL ?? "http://localhost:3000";
const password = "correct-horse-battery";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const fakePng = Buffer.from("not-a-png");
const svgBytes = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>");

function cookieHeader(response: Response): string {
  const raw = response.headers.get("set-cookie");
  if (!raw) {
    throw new Error("missing session cookie");
  }
  return raw.split(";")[0] ?? "";
}

describe("uploads and image jobs", () => {
  const pool = new Pool({ connectionString });
  let db: Database;
  let storage: MemoryStorage;
  let session: { cookie: string; csrf: string; adminId: string };

  beforeAll(() => {
    process.env.STORAGE_DRIVER = "memory";
    resetProcessEnvForTests();
    db = createDatabase(pool);
  });

  beforeEach(async () => {
    await truncateApplicationTables(pool);
    storage = new MemoryStorage();
    setStorageForTests(storage);
    await createInitialAdmin(db, { username: "editor", password });
    const [admin] = await db.select().from(admins);
    if (!admin) {
      throw new Error("missing admin");
    }
    const response = await login(
      new Request(`${origin}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          "x-real-ip": "203.0.113.40",
        },
        body: JSON.stringify({ username: "editor", password }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { csrfToken: string } };
    session = {
      cookie: cookieHeader(response),
      csrf: body.data.csrfToken,
      adminId: admin.id,
    };
  });

  afterAll(async () => {
    setStorageForTests(undefined);
    delete process.env.STORAGE_DRIVER;
    resetProcessEnvForTests();
    await closeDatabase();
    await pool.end();
  });

  function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
    return new Request(`${origin}${path}`, {
      method: "POST",
      headers: {
        origin,
        cookie: session.cookie,
        "x-csrf-token": session.csrf,
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  async function openBatch(
    mode: "single" | "multiple",
    items: Array<{ clientItemId: string; name: string; size: number; type: string }>,
    extra: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) {
    const response = await createBatch(
      jsonRequest(
        "/api/v1/admin/upload-batches",
        { mode, items, ...extra },
        headers,
      ),
    );
    const payload = (await response.json()) as {
      data?: { batchId: string; items: Array<{ id: string; promptId: string | null }> };
      error?: { code: string };
    };
    return { status: response.status, payload };
  }

  it("keeps one draft for single mode and one draft per item for multiple mode", async () => {
    const single = await openBatch("single", [
      { clientItemId: "a", name: "a.png", size: png.byteLength, type: "image/png" },
      { clientItemId: "b", name: "b.png", size: png.byteLength, type: "image/png" },
    ]);
    expect(single.status).toBe(200);
    const singlePrompts = new Set(single.payload.data?.items.map((item) => item.promptId));
    expect(singlePrompts.size).toBe(1);

    const existing = await createEmptyPrompt(db, {
      adminId: session.adminId,
      requestId: "append",
      title: "已有草稿",
    });
    const appended = await openBatch(
      "single",
      [{ clientItemId: "c", name: "c.png", size: png.byteLength, type: "image/png" }],
      { targetPromptId: existing.id },
    );
    expect(appended.payload.data?.items[0]?.promptId).toBe(existing.id);

    const multiple = await openBatch("multiple", [
      { clientItemId: "d", name: "d.png", size: png.byteLength, type: "image/png" },
      { clientItemId: "e", name: "e.png", size: png.byteLength, type: "image/png" },
    ]);
    const multiplePrompts = new Set(multiple.payload.data?.items.map((item) => item.promptId));
    expect(multiplePrompts.size).toBe(2);
  });

  it("replays the same idempotency key and rejects a different body", async () => {
    const items = [
      { clientItemId: "same", name: "same.png", size: png.byteLength, type: "image/png" },
    ];
    const first = await openBatch("single", items, {}, { "idempotency-key": "batch-key-001" });
    const second = await openBatch("single", items, {}, { "idempotency-key": "batch-key-001" });
    expect(second.payload.data?.batchId).toBe(first.payload.data?.batchId);
    const conflict = await openBatch(
      "multiple",
      items,
      {},
      { "idempotency-key": "batch-key-001" },
    );
    expect(conflict.status).toBe(409);
  });

  it("stores derivatives for a real image and rejects a fake extension, svg, and oversized body", async () => {
    const opened = await openBatch("single", [
      { clientItemId: "real", name: "real.png", size: png.byteLength, type: "image/png" },
      { clientItemId: "fake", name: "fake.png", size: fakePng.byteLength, type: "image/png" },
      {
        clientItemId: "svg",
        name: "drawing.svg",
        size: svgBytes.byteLength,
        type: "image/svg+xml",
      },
    ]);
    const items = opened.payload.data?.items ?? [];
    const real = items[0];
    const fake = items[1];
    const svg = items[2];
    if (!real || !fake || !svg) {
      throw new Error("missing upload items");
    }

    const uploaded = await uploadFile(
      new Request(`${origin}/api/v1/admin/upload-items/${real.id}/file`, {
        method: "PUT",
        headers: {
          origin,
          cookie: session.cookie,
          "x-csrf-token": session.csrf,
          "content-type": "image/png",
        },
        body: png,
      }),
      { params: Promise.resolve({ id: real.id }) },
    );
    expect(uploaded.status).toBe(202);
    const ready = await readBatch(
      new Request(`${origin}/api/v1/admin/upload-batches/${opened.payload.data?.batchId}`, {
        headers: { cookie: session.cookie },
      }),
      { params: Promise.resolve({ id: opened.payload.data?.batchId ?? "" }) },
    );
    const readyBody = (await ready.json()) as {
      data: { items: Array<{ id: string; status: string }> };
    };
    expect(readyBody.data.items.find((item) => item.id === real.id)?.status).toBe("ready");
    const [asset] = await db.select().from(assets).where(eq(assets.status, "ready"));
    expect(asset?.originalKey).toMatch(/\/original\.webp$/);
    expect(asset?.cardKey).toBeTruthy();
    expect(asset?.detailKey).toBeTruthy();
    expect(storage.objects.has(asset?.sourceKey ?? "")).toBe(true);
    expect(storage.objects.has(asset?.originalKey ?? "")).toBe(true);
    const links = await db.select().from(promptAssets);
    expect(links).toHaveLength(1);
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, real.promptId ?? ""));
    expect(prompt?.coverAssetId).toBe(asset?.id);

    await uploadFile(
      new Request(`${origin}/api/v1/admin/upload-items/${fake.id}/file`, {
        method: "PUT",
        headers: {
          origin,
          cookie: session.cookie,
          "x-csrf-token": session.csrf,
          "content-type": "image/png",
        },
        body: fakePng,
      }),
      { params: Promise.resolve({ id: fake.id }) },
    );
    const [failed] = await db.select().from(uploadItems).where(eq(uploadItems.id, fake.id));
    expect(failed?.status).toBe("failed");
    expect(failed?.errorCode).toBe("UNSUPPORTED_MEDIA");
    const failedJobs = await db.select().from(jobs).where(eq(jobs.status, "failed"));
    expect(failedJobs.length).toBeGreaterThan(0);
    expect(await claimJob(db)).toBeNull();

    await uploadFile(
      new Request(`${origin}/api/v1/admin/upload-items/${svg.id}/file`, {
        method: "PUT",
        headers: {
          origin,
          cookie: session.cookie,
          "x-csrf-token": session.csrf,
          "content-type": "image/svg+xml",
        },
        body: svgBytes,
      }),
      { params: Promise.resolve({ id: svg.id }) },
    );
    const [svgItem] = await db.select().from(uploadItems).where(eq(uploadItems.id, svg.id));
    expect(svgItem?.status).toBe("failed");

    const huge = await openBatch("single", [
      {
        clientItemId: "huge",
        name: "huge.png",
        size: UPLOAD_MAX_BYTES,
        type: "image/png",
      },
    ]);
    const hugeItem = huge.payload.data?.items[0];
    if (!hugeItem) {
      throw new Error("missing huge item");
    }
    const tooBig = await uploadFile(
      new Request(`${origin}/api/v1/admin/upload-items/${hugeItem.id}/file`, {
        method: "PUT",
        headers: {
          origin,
          cookie: session.cookie,
          "x-csrf-token": session.csrf,
          "content-type": "image/png",
        },
        body: new Uint8Array(UPLOAD_MAX_BYTES + 1),
      }),
      { params: Promise.resolve({ id: hugeItem.id }) },
    );
    expect(tooBig.status).toBe(413);
  });

  it("retries a transient processing failure and ignores a stale lease", async () => {
    const opened = await openBatch("single", [
      { clientItemId: "retry", name: "retry.png", size: png.byteLength, type: "image/png" },
    ]);
    const item = opened.payload.data?.items[0];
    if (!item) {
      throw new Error("missing item");
    }
    let failures = 1;
    const flaky: ObjectStorage = {
      async put(key, body, contentType) {
        await storage.put(key, body, contentType);
      },
      async get(key) {
        if (failures > 0 && key.startsWith("tmp/")) {
          failures -= 1;
          throw new Error("temporary storage failure");
        }
        return storage.get(key);
      },
      async delete(key) {
        await storage.delete(key);
      },
      async list(prefix) {
        return storage.list(prefix);
      },
      async ready() {},
    };
    setStorageForTests(flaky);
    await receiveUploadFile(db, flaky, {
      adminId: session.adminId,
      itemId: item.id,
      request: new Request(`${origin}/file`, { method: "PUT", body: png }),
    });
    expect(await runClaimedJobs(5)).toBe(1);
    const [waiting] = await db.select().from(jobs);
    expect(waiting?.status).toBe("queued");
    expect(waiting?.attempts).toBe(1);
    await db.update(jobs).set({ runAt: new Date(Date.now() - 1000) });
    expect(await runClaimedJobs(5)).toBe(1);
    const [done] = await db.select().from(uploadItems).where(eq(uploadItems.id, item.id));
    expect(done?.status).toBe("ready");

    await enqueueJob(db, {
      type: "cleanup",
      dedupeKey: "lease-probe",
      payload: {},
    });
    const first = await claimJob(db);
    if (!first) {
      throw new Error("job was not claimed");
    }
    await db
      .update(jobs)
      .set({ lockedUntil: new Date(Date.now() - 1000) })
      .where(eq(jobs.id, first.id));
    const second = await claimJob(db);
    expect(second?.id).toBe(first.id);
    expect(second?.leaseToken).not.toBe(first.leaseToken);
    expect(await completeJob(db, first.id, first.leaseToken)).toBe(false);
    expect(await completeJob(db, second!.id, second!.leaseToken)).toBe(true);
    expect(await completeJob(db, second!.id, second!.leaseToken)).toBe(false);
  });

  it("deletes the temporary object when the database write fails", async () => {
    const opened = await openBatch("single", [
      { clientItemId: "db", name: "db.png", size: png.byteLength, type: "image/png" },
    ]);
    const item = opened.payload.data?.items[0];
    if (!item) {
      throw new Error("missing item");
    }
    const inner = new MemoryStorage();
    const failing: ObjectStorage = {
      async put(key, body, contentType) {
        await inner.put(key, body, contentType);
        if (key.startsWith("tmp/")) {
          await db.insert(assets).values({ status: "uploading", sourceKey: key });
        }
      },
      get: (key) => inner.get(key),
      delete: (key) => inner.delete(key),
      list: (prefix) => inner.list(prefix),
      async ready() {},
    };
    await expect(
      receiveUploadFile(db, failing, {
        adminId: session.adminId,
        itemId: item.id,
        request: new Request(`${origin}/file`, { method: "PUT", body: png }),
      }),
    ).rejects.toThrow();
    expect([...inner.objects.keys()].some((key) => key.startsWith("tmp/"))).toBe(false);
    const [row] = await db.select().from(uploadItems).where(eq(uploadItems.id, item.id));
    expect(row?.status).toBe("pending");
    expect(row?.assetId).toBeNull();
  });
});
