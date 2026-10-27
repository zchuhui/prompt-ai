"use client";

import { ArrowDown, ArrowUp, CircleAlert, GripVertical, ImageOff, LoaderCircle, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { describeProcessingError } from "@/features/uploads/upload-store";
import type { EditorAsset } from "../editor-state";

const iconButton =
  "inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";

export function EditorImages({
  items,
  coverAssetId,
  error,
  onMove,
  onCover,
  onAlt,
  onRemove,
}: {
  items: EditorAsset[];
  coverAssetId: string | null;
  error?: string;
  onMove: (from: number, to: number) => void;
  onCover: (assetId: string) => void;
  onAlt: (assetId: string, alt: string) => void;
  onRemove: (assetId: string) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted",
          error ? "border-danger/50" : "border-border-strong",
        )}
      >
        <ImageOff aria-hidden="true" className="size-5" />
        还没有图片，在下方上传
        {error ? (
          <span className="text-xs text-danger" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <ol aria-label="图片顺序" className="grid gap-2">
        {items.map((item, index) => {
          const isCover = item.assetId === coverAssetId;
          return (
            <li
              className={cn(
                "flex gap-3 rounded-xl border bg-surface/60 p-2 transition-colors",
                isCover ? "border-accent/40" : "border-border",
                overIndex === index && dragIndex !== null && dragIndex !== index && "border-accent bg-accent/5",
                dragIndex === index && "opacity-50",
              )}
              draggable
              key={item.assetId}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragOver={(event) => {
                if (dragIndex === null) {
                  return;
                }
                event.preventDefault();
                setOverIndex(index);
              }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.assetId);
                setDragIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex !== null) {
                  onMove(dragIndex, index);
                }
                setDragIndex(null);
                setOverIndex(null);
              }}
            >
              <div className="flex shrink-0 flex-col items-center justify-between py-1 text-muted">
                <GripVertical aria-hidden="true" className="size-4 cursor-grab" />
                <span className="font-mono text-[11px]">{index + 1}</span>
              </div>
              <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                {item.status === "ready" ? (
                  <img
                    alt=""
                    className="size-full object-cover"
                    draggable={false}
                    src={`/api/v1/admin/media/${item.assetId}/card`}
                  />
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-1 text-[11px] text-muted">
                    {item.status === "failed" ? (
                      <CircleAlert aria-hidden="true" className="size-4 text-danger" />
                    ) : (
                      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                    )}
                    {item.status === "failed" ? "处理失败" : "处理中"}
                  </span>
                )}
                {isCover ? (
                  <Badge className="absolute top-1 left-1" tone="accent">
                    封面
                  </Badge>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  aria-label={`第 ${index + 1} 张图片的替代文字`}
                  className="min-h-9 w-full rounded-md border border-border bg-background/60 px-2.5 text-xs placeholder:text-muted/70 focus:border-accent focus:outline-none"
                  maxLength={300}
                  placeholder="替代文字（留空则使用标题）"
                  value={item.alt ?? ""}
                  onChange={(event) => onAlt(item.assetId, event.target.value)}
                />
                {item.status === "failed" ? (
                  <p className="text-[11px] text-danger">{describeProcessingError(item.errorCode)}</p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center gap-0.5">
                  <button
                    aria-label="上移"
                    className={iconButton}
                    disabled={index === 0}
                    title="上移"
                    type="button"
                    onClick={() => onMove(index, index - 1)}
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    aria-label="下移"
                    className={iconButton}
                    disabled={index === items.length - 1}
                    title="下移"
                    type="button"
                    onClick={() => onMove(index, index + 1)}
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    aria-pressed={isCover}
                    className={cn(
                      "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs transition-colors disabled:opacity-40",
                      isCover ? "text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground",
                    )}
                    disabled={item.status !== "ready"}
                    type="button"
                    onClick={() => onCover(item.assetId)}
                  >
                    <Star aria-hidden="true" className={cn("size-3.5", isCover && "fill-current")} />
                    {isCover ? "当前封面" : "设为封面"}
                  </button>
                  <button
                    aria-label="移除图片"
                    className={cn(iconButton, "ml-auto hover:bg-danger/10 hover:text-danger")}
                    title="移除"
                    type="button"
                    onClick={() => onRemove(item.assetId)}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
