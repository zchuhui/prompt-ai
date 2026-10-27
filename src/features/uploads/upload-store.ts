import { UPLOAD_BATCH_MAX_ITEMS, UPLOAD_MAX_BYTES } from "@/shared/constants";
import { adminFetch, errorMessage } from "@/features/auth/admin-client";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const UPLOAD_CONCURRENCY = 3;
const POLL_MS = 2000;

export type UploadStatus =
  | "rejected"
  | "queued"
  | "uploading"
  | "processing"
  | "ready"
  | "failed"
  | "upload_error";

export type UploadEntry = {
  key: string;
  name: string;
  size: number;
  preview: string | null;
  status: UploadStatus;
  progress: number;
  error: string | null;
  batchId: string | null;
  itemId: string | null;
  promptId: string | null;
  assetId: string | null;
};

export type UploadOptions = {
  csrfToken: string;
  mode: "single" | "multiple";
  targetPromptId?: string;
  defaults?: { categoryId?: string; modelId?: string; tagIds?: string[] };
  maxItems: number;
  onItemReady?: (entry: UploadEntry) => void;
  onSettled?: () => void;
};

type ServerItem = {
  id: string;
  clientItemId: string;
  promptId: string | null;
  assetId?: string | null;
  status: string;
  errorCode?: string | null;
};

const processingErrors: Record<string, string> = {
  UNSUPPORTED_MEDIA: "不支持的图片格式或文件已损坏",
  IMAGE_LIMIT: "图片像素超出限制",
  PROCESSING_FAILED: "图片处理失败",
};

export function describeProcessingError(code: string | null | undefined): string {
  return (code && processingErrors[code]) ?? "图片处理失败";
}

export function validateFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    return "只支持 JPEG、PNG、WebP";
  }
  if (file.size === 0) {
    return "文件为空";
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return "文件超过 20 MiB";
  }
  return null;
}

export function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(0)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function mapStatus(status: string): UploadStatus {
  if (status === "ready" || status === "failed" || status === "processing") {
    return status;
  }
  return status === "uploading" ? "uploading" : "queued";
}

export function createUploadStore(initial: UploadOptions) {
  let options = initial;
  const getOptions = () => options;
  let entries: UploadEntry[] = [];
  const files = new Map<string, File>();
  const inflight = new Set<string>();
  const listeners = new Set<() => void>();
  let pollTimer: number | null = null;
  let polling = false;
  let disposed = false;

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const update = (key: string, patch: Partial<UploadEntry>) => {
    let changed: UploadEntry | null = null;
    entries = entries.map((entry) => {
      if (entry.key !== key) {
        return entry;
      }
      changed = { ...entry, ...patch };
      return changed;
    });
    emit();
    return changed as UploadEntry | null;
  };

  const markReady = (key: string, patch: Partial<UploadEntry>) => {
    const before = entries.find((entry) => entry.key === key);
    const after = update(key, { ...patch, status: "ready", progress: 1, error: null });
    if (after && before?.status !== "ready") {
      getOptions().onItemReady?.(after);
    }
  };

  const settledCheck = () => {
    const busy = entries.some((entry) =>
      ["queued", "uploading", "processing"].includes(entry.status),
    );
    if (!busy) {
      getOptions().onSettled?.();
    }
  };

  const upload = (entry: UploadEntry) => {
    const file = files.get(entry.key);
    if (!file || !entry.itemId) {
      return;
    }
    inflight.add(entry.key);
    update(entry.key, { status: "uploading", progress: 0, error: null });
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/v1/admin/upload-items/${entry.itemId}/file`);
    xhr.setRequestHeader("x-csrf-token", getOptions().csrfToken);
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        update(entry.key, { progress: Math.min(0.99, event.loaded / event.total) });
      }
    };
    const finish = (patch: Partial<UploadEntry>) => {
      inflight.delete(entry.key);
      if (disposed) {
        return;
      }
      if (patch.status === "ready") {
        markReady(entry.key, patch);
      } else {
        update(entry.key, patch);
      }
      pump();
      ensurePolling();
      settledCheck();
    };
    xhr.onload = () => {
      let payload: { data?: ServerItem; error?: { message?: string } } = {};
      try {
        payload = JSON.parse(xhr.responseText) as typeof payload;
      } catch {
        payload = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload.data) {
        finish({
          status: mapStatus(payload.data.status),
          assetId: payload.data.assetId ?? null,
          progress: 1,
        });
        return;
      }
      finish({ status: "upload_error", error: payload.error?.message ?? `上传失败（${xhr.status}）` });
    };
    xhr.onerror = () => finish({ status: "upload_error", error: "网络中断，可以重试" });
    xhr.onabort = () => finish({ status: "upload_error", error: "上传已取消" });
    xhr.send(file);
  };

  const pump = () => {
    const free = UPLOAD_CONCURRENCY - inflight.size;
    if (free <= 0) {
      return;
    }
    const next = entries
      .filter((entry) => entry.status === "queued" && entry.itemId && !inflight.has(entry.key))
      .slice(0, free);
    for (const entry of next) {
      upload(entry);
    }
  };

  const poll = async () => {
    if (polling || disposed) {
      return;
    }
    if (typeof document !== "undefined" && document.hidden) {
      return;
    }
    const batchIds = [
      ...new Set(
        entries
          .filter((entry) => entry.status === "processing" && entry.batchId)
          .map((entry) => entry.batchId as string),
      ),
    ];
    if (batchIds.length === 0) {
      stopPolling();
      return;
    }
    polling = true;
    try {
      for (const batchId of batchIds) {
        const batch = await adminFetch<{ items: ServerItem[] }>(
          `/api/v1/admin/upload-batches/${batchId}`,
          getOptions().csrfToken,
        );
        for (const item of batch.items) {
          const entry = entries.find((candidate) => candidate.key === item.clientItemId);
          if (!entry || entry.status !== "processing") {
            continue;
          }
          if (item.status === "ready") {
            markReady(entry.key, { assetId: item.assetId ?? entry.assetId, promptId: item.promptId });
          } else if (item.status === "failed") {
            update(entry.key, { status: "failed", error: describeProcessingError(item.errorCode) });
          }
        }
      }
    } catch {
      // Transient polling errors are retried on the next tick.
    } finally {
      polling = false;
    }
    settledCheck();
    if (!entries.some((entry) => entry.status === "processing")) {
      stopPolling();
    }
  };

  const ensurePolling = () => {
    if (pollTimer !== null || !entries.some((entry) => entry.status === "processing")) {
      return;
    }
    pollTimer = window.setInterval(() => void poll(), POLL_MS);
  };

  const stopPolling = () => {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  return {
    configure(next: UploadOptions) {
      options = next;
    },
    getSnapshot: () => entries,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async add(incoming: File[]) {
      const options = getOptions();
      const accepted: UploadEntry[] = [];
      const additions: UploadEntry[] = [];
      const limit = Math.min(options.maxItems, UPLOAD_BATCH_MAX_ITEMS);
      for (const file of incoming) {
        const key = crypto.randomUUID();
        const problem =
          validateFile(file) ?? (accepted.length >= limit ? `一次最多 ${limit} 张` : null);
        const entry: UploadEntry = {
          key,
          name: file.name || "粘贴的图片",
          size: file.size,
          preview: problem ? null : URL.createObjectURL(file),
          status: problem ? "rejected" : "queued",
          progress: 0,
          error: problem,
          batchId: null,
          itemId: null,
          promptId: null,
          assetId: null,
        };
        additions.push(entry);
        if (!problem) {
          accepted.push(entry);
          files.set(key, file);
        }
      }
      entries = [...additions, ...entries];
      emit();
      if (accepted.length === 0) {
        return;
      }
      try {
        const batch = await adminFetch<{ batchId: string; items: ServerItem[] }>(
          "/api/v1/admin/upload-batches",
          options.csrfToken,
          {
            method: "POST",
            headers: { "idempotency-key": crypto.randomUUID() },
            body: JSON.stringify({
              mode: options.mode,
              ...(options.targetPromptId ? { targetPromptId: options.targetPromptId } : {}),
              ...(options.defaults ? { defaults: options.defaults } : {}),
              items: accepted.map((entry) => ({
                clientItemId: entry.key,
                name: entry.name.slice(0, 300),
                size: entry.size,
                type: files.get(entry.key)?.type ?? "application/octet-stream",
              })),
            }),
          },
        );
        for (const item of batch.items) {
          update(item.clientItemId, {
            batchId: batch.batchId,
            itemId: item.id,
            promptId: item.promptId,
          });
        }
      } catch (error) {
        const message = errorMessage(error, "无法创建上传");
        for (const entry of accepted) {
          files.delete(entry.key);
          update(entry.key, { status: "rejected", error: message });
        }
        return;
      }
      pump();
    },
    async retry(key: string) {
      const entry = entries.find((candidate) => candidate.key === key);
      if (!entry) {
        return;
      }
      if (entry.status === "upload_error") {
        update(key, { status: "queued", error: null, progress: 0 });
        pump();
        return;
      }
      if (entry.status === "failed" && entry.itemId) {
        try {
          await adminFetch(`/api/v1/admin/upload-items/${entry.itemId}/retry`, getOptions().csrfToken, {
            method: "POST",
          });
          update(key, { status: "processing", error: null });
          ensurePolling();
        } catch (error) {
          update(key, { error: errorMessage(error, "无法重试") });
        }
      }
    },
    remove(key: string) {
      const entry = entries.find((candidate) => candidate.key === key);
      if (!entry || inflight.has(key)) {
        return;
      }
      if (entry.preview) {
        URL.revokeObjectURL(entry.preview);
      }
      files.delete(key);
      entries = entries.filter((candidate) => candidate.key !== key);
      emit();
    },
    clearFinished() {
      for (const entry of entries) {
        if ((entry.status === "ready" || entry.status === "rejected") && entry.preview) {
          URL.revokeObjectURL(entry.preview);
        }
      }
      entries = entries.filter((entry) => entry.status !== "ready" && entry.status !== "rejected");
      emit();
    },
    resume() {
      void poll();
    },
    attach() {
      disposed = false;
      ensurePolling();
      return () => {
        disposed = true;
        stopPolling();
      };
    },
  };
}

export type UploadStore = ReturnType<typeof createUploadStore>;
