"use client";

import { X } from "lucide-react";
import { useRef } from "react";
import { cn } from "./utils";

export function Sheet({
  title,
  trigger,
  triggerClassName,
  triggerLabel,
  side = "right",
  closeOnNavigate = true,
  children,
}: {
  title: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  side?: "right" | "left" | "bottom";
  closeOnNavigate?: boolean;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const position =
    side === "bottom"
      ? "mt-auto mb-0 max-h-[85dvh] w-full max-w-none rounded-t-2xl border-t"
      : side === "left"
        ? "mr-auto ml-0 h-dvh max-h-none w-[min(22rem,88vw)] border-r"
        : "mr-0 ml-auto h-dvh max-h-none w-[min(22rem,88vw)] border-l";

  return (
    <>
      <button
        aria-label={triggerLabel}
        className={triggerClassName}
        type="button"
        onClick={() => dialog.current?.showModal()}
      >
        {trigger}
      </button>
      <dialog
        aria-label={title}
        className={cn(
          "fixed m-0 border-border bg-surface p-0 text-foreground backdrop:bg-black/70",
          position,
        )}
        ref={dialog}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            dialog.current?.close();
            return;
          }
          if (closeOnNavigate && (event.target as HTMLElement).closest("a[href]")) {
            dialog.current?.close();
          }
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="font-mono text-xs tracking-[0.2em] text-muted uppercase">{title}</p>
            <button
              aria-label="关闭"
              className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
              type="button"
              onClick={() => dialog.current?.close()}
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      </dialog>
    </>
  );
}
