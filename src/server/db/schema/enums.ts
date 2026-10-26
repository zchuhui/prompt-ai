import { pgEnum } from "drizzle-orm/pg-core";

export const promptStatus = pgEnum("prompt_status", ["draft", "published"]);
export const sourceType = pgEnum("source_type", ["original", "collected"]);
export const assetStatus = pgEnum("asset_status", [
  "uploading",
  "queued",
  "processing",
  "ready",
  "failed",
]);
export const collectionStatus = pgEnum("collection_status", [
  "draft",
  "published",
]);
export const uploadMode = pgEnum("upload_mode", ["single", "multiple"]);
export const uploadItemStatus = pgEnum("upload_item_status", [
  "pending",
  "uploading",
  "processing",
  "ready",
  "failed",
]);
export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "done",
  "failed",
]);
export const analyticsEventKind = pgEnum("analytics_event_kind", [
  "page_view",
  "detail_view",
  "prompt_copy",
  "search",
  "search_empty",
]);
