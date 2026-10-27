import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST as createCategory } from "../../src/app/api/v1/admin/categories/route";
import { DELETE as deleteCategory, PATCH as patchCategory } from "../../src/app/api/v1/admin/categories/[id]/route";
import { POST as createCollection } from "../../src/app/api/v1/admin/collections/route";
import { DELETE as deleteCollection, PATCH as patchCollection } from "../../src/app/api/v1/admin/collections/[id]/route";
import { GET as adminMedia } from "../../src/app/api/v1/admin/media/[id]/[variant]/route";
import { POST as createModel } from "../../src/app/api/v1/admin/models/route";
import { DELETE as deleteModel, PATCH as patchModel } from "../../src/app/api/v1/admin/models/[id]/route";
import { POST as batchPrompts } from "../../src/app/api/v1/admin/prompts/batch/route";
import { POST as createPrompt, GET as listPrompts } from "../../src/app/api/v1/admin/prompts/route";
import { DELETE as deletePrompt, PATCH as patchPrompt } from "../../src/app/api/v1/admin/prompts/[id]/route";
import { POST as duplicatePrompt } from "../../src/app/api/v1/admin/prompts/[id]/duplicate/route";
import { POST as publishPrompt } from "../../src/app/api/v1/admin/prompts/[id]/publish/route";
import { POST as unpublishPrompt } from "../../src/app/api/v1/admin/prompts/[id]/unpublish/route";
import { POST as createTag } from "../../src/app/api/v1/admin/tags/route";
import { DELETE as deleteTag, PATCH as patchTag } from "../../src/app/api/v1/admin/tags/[id]/route";
import { POST as createUpload } from "../../src/app/api/v1/admin/upload-batches/route";
import { PUT as uploadFile } from "../../src/app/api/v1/admin/upload-items/[id]/file/route";
import { POST as retryUpload } from "../../src/app/api/v1/admin/upload-items/[id]/retry/route";
import { closeDatabase } from "../../src/server/db/client";
import { loadLocalEnv } from "../../src/server/load-env";

loadLocalEnv();

const origin = process.env.APP_URL ?? "http://localhost:3000";
const id = "00000000-0000-4000-8000-000000000001";

function write(path: string, method: string): Request {
  return new Request(`${origin}${path}`, {
    method,
    headers: { origin, "content-type": "application/json" },
    body: method === "GET" || method === "HEAD" ? undefined : "{}",
  });
}

describe("unauthenticated admin writes", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("returns 401 for every admin write and preview route", async () => {
    const item = { params: Promise.resolve({ id }) };
    const media = { params: Promise.resolve({ id, variant: "card" }) };
    const responses = await Promise.all([
      listPrompts(write("/api/v1/admin/prompts", "GET")),
      createPrompt(write("/api/v1/admin/prompts", "POST")),
      patchPrompt(write(`/api/v1/admin/prompts/${id}`, "PATCH"), item),
      deletePrompt(write(`/api/v1/admin/prompts/${id}`, "DELETE"), item),
      publishPrompt(write(`/api/v1/admin/prompts/${id}/publish`, "POST"), item),
      unpublishPrompt(write(`/api/v1/admin/prompts/${id}/unpublish`, "POST"), item),
      duplicatePrompt(write(`/api/v1/admin/prompts/${id}/duplicate`, "POST"), item),
      batchPrompts(write("/api/v1/admin/prompts/batch", "POST")),
      createUpload(write("/api/v1/admin/upload-batches", "POST")),
      uploadFile(write(`/api/v1/admin/upload-items/${id}/file`, "PUT"), item),
      retryUpload(write(`/api/v1/admin/upload-items/${id}/retry`, "POST"), item),
      createCategory(write("/api/v1/admin/categories", "POST")),
      patchCategory(write(`/api/v1/admin/categories/${id}`, "PATCH"), item),
      deleteCategory(write(`/api/v1/admin/categories/${id}`, "DELETE"), item),
      createTag(write("/api/v1/admin/tags", "POST")),
      patchTag(write(`/api/v1/admin/tags/${id}`, "PATCH"), item),
      deleteTag(write(`/api/v1/admin/tags/${id}`, "DELETE"), item),
      createModel(write("/api/v1/admin/models", "POST")),
      patchModel(write(`/api/v1/admin/models/${id}`, "PATCH"), item),
      deleteModel(write(`/api/v1/admin/models/${id}`, "DELETE"), item),
      createCollection(write("/api/v1/admin/collections", "POST")),
      patchCollection(write(`/api/v1/admin/collections/${id}`, "PATCH"), item),
      deleteCollection(write(`/api/v1/admin/collections/${id}`, "DELETE"), item),
      adminMedia(write(`/api/v1/admin/media/${id}/card`, "GET"), media),
    ]);
    expect(responses.map((response) => response.status)).toEqual(
      responses.map(() => 401),
    );
  });
});
