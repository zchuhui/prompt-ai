"use client";

import { CircleAlert, CircleCheck, ImagePlus, LoaderCircle, RotateCw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useCsrfToken } from "@/features/auth/admin-client";
import { ACCEPTED_TYPES, formatBytes, type UploadEntry, type UploadOptions, type UploadStatus } from "../upload-store";
import { useUploadQueue } from "../use-upload-queue";

const statusLabel: Record<UploadStatus, { text: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  rejected: { text: "未上传", tone: "danger" },
  queued: { text: "排队中", tone: "neutral" },
  uploading: { text: "上传中", tone: "accent" },
  processing: { text: "处理中", tone: "warning" },
  ready: { text: "完成", tone: "success" },
  failed: { text: "处理失败", tone: "danger" },
  upload_error: { text: "上传失败", tone: "danger" },
};

function EntryRow({
  entry,
  showPromptLink,
  onRetry,
  onRemove,
}: {
  entry: UploadEntry;
  showPromptLink: boolean;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const label = statusLabel[entry.status];
  const busy = entry.status === "uploading" || entry.status === "processing" || entry.status === "queued";
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <div className="relative size-11 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
        {entry.preview ? (
          <img alt="" className="size-full object-cover" src={entry.preview} />
        ) : (
          <span className="flex size-full items-center justify-center text-muted">
            <CircleAlert aria-hidden="true" className="size-4" />
          </span>
        )}
        {entry.status === "processing" ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-white" />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm">{entry.name}</p>
          <span className="shrink-0 font-mono text-[11px] text-muted">{formatBytes(entry.size)}</span>
        </div>
        {entry.status === "uploading" ? (
          <div
            aria-label={`${entry.name} 上传进度`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(entry.progress * 100)}
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${Math.round(entry.progress * 100)}%` }}
            />
          </div>
        ) : entry.status === "processing" ? (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full w-1/3 rounded-full bg-warning/70 motion-safe:animate-[indeterminate_1.2s_ease-in-out_infinite]" />
          </div>
        ) : entry.error ? (
          <p className="mt-0.5 text-xs text-danger" role="alert">
            {entry.error}
          </p>
        ) : null}
      </div>
      <Badge className="shrink-0" tone={label.tone}>
        {entry.status === "ready" ? <CircleCheck aria-hidden="true" className="size-3" /> : null}
        {entry.status === "uploading" ? `${Math.round(entry.progress * 100)}%` : label.text}
      </Badge>
      <div className="flex shrink-0 items-center gap-0.5">
        {showPromptLink && entry.promptId && entry.status !== "rejected" ? (
          <Link
            className="inline-flex min-h-9 items-center rounded-md px-2 text-xs text-accent hover:bg-accent/10"
            href={`/admin/prompts/${entry.promptId}/edit`}
          >
            编辑草稿
          </Link>
        ) : null}
        {entry.status === "upload_error" || entry.status === "failed" ? (
          <button
            aria-label={`重试 ${entry.name}`}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
            title="重试"
            type="button"
            onClick={onRetry}
          >
            <RotateCw aria-hidden="true" className="size-4" />
          </button>
        ) : null}
        {!busy ? (
          <button
            aria-label={`移除 ${entry.name}`}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
            title="从列表移除"
            type="button"
            onClick={onRemove}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function UploadQueue({
  mode,
  targetPromptId,
  defaults,
  maxItems,
  disabled = false,
  disabledReason,
  compact = false,
  showPromptLinks = false,
  enablePaste = true,
  onItemReady,
  onSettled,
}: Omit<UploadOptions, "csrfToken"> & {
  disabled?: boolean;
  disabledReason?: string;
  compact?: boolean;
  showPromptLinks?: boolean;
  enablePaste?: boolean;
}) {
  const csrfToken = useCsrfToken();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { entries, store } = useUploadQueue({
    csrfToken,
    mode,
    targetPromptId,
    defaults,
    maxItems,
    onItemReady,
    onSettled,
  });

  useEffect(() => {
    if (!enablePaste || disabled) {
      return;
    }
    const onPaste = (event: ClipboardEvent) => {
      const pasted = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
      if (pasted.length > 0) {
        event.preventDefault();
        void store.add(pasted);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled, enablePaste, store]);

  const done = entries.filter((entry) => entry.status === "ready").length;
  const failed = entries.filter((entry) =>
    ["failed", "upload_error", "rejected"].includes(entry.status),
  ).length;
  const active = entries.length - done - failed;

  return (
    <div className="grid gap-3">
      <label
        aria-disabled={disabled || undefined}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center transition-colors focus-within:border-accent/60",
          compact ? "px-4 py-6" : "px-6 py-12",
          dragging ? "border-accent bg-accent/10" : "border-border-strong bg-surface/40 hover:border-accent/50 hover:bg-accent/5",
          disabled && "pointer-events-none opacity-50",
        )}
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragging(false);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) {
            void store.add([...event.dataTransfer.files]);
          }
        }}
      >
        <span className="flex size-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
          <ImagePlus aria-hidden="true" className="size-5" />
        </span>
        <span className="text-sm font-medium">
          {disabled && disabledReason ? disabledReason : "拖入图片，或点击选择"}
        </span>
        <span className="text-xs text-muted">
          JPEG / PNG / WebP · 单张 ≤ 20 MiB · 每次最多 {maxItems} 张{enablePaste ? " · 支持粘贴" : ""}
        </span>
        <input
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          disabled={disabled}
          id={inputId}
          multiple
          ref={input}
          type="file"
          onChange={(event) => {
            const chosen = [...(event.target.files ?? [])];
            event.target.value = "";
            if (chosen.length > 0) {
              void store.add(chosen);
            }
          }}
        />
      </label>
      {entries.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface/50">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <p aria-live="polite" className="font-mono text-[11px] text-muted">
              完成 <span className="text-success">{done}</span>
              {active > 0 ? (
                <>
                  {" "}
                  · 进行中 <span className="text-accent">{active}</span>
                </>
              ) : null}
              {failed > 0 ? (
                <>
                  {" "}
                  · 失败 <span className="text-danger">{failed}</span>
                </>
              ) : null}
            </p>
            {entries.some((entry) => entry.status === "ready" || entry.status === "rejected") ? (
              <Button size="sm" type="button" variant="ghost" onClick={() => store.clearFinished()}>
                清除已完成
              </Button>
            ) : null}
          </div>
          <ul className={cn("divide-y divide-border overflow-y-auto", compact ? "max-h-72" : "max-h-[32rem]")}>
            {entries.map((entry) => (
              <EntryRow
                entry={entry}
                key={entry.key}
                showPromptLink={showPromptLinks}
                onRemove={() => store.remove(entry.key)}
                onRetry={() => void store.retry(entry.key)}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
