"use client";

import { ImageOff } from "lucide-react";
import { cn } from "@/components/ui/utils";

export function AdminThumb({ assetId, className }: { assetId: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2 text-muted",
        className,
      )}
    >
      <ImageOff aria-hidden="true" className="size-4" />
      {assetId ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          draggable={false}
          loading="lazy"
          src={`/api/v1/admin/media/${assetId}/card`}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : null}
    </span>
  );
}
