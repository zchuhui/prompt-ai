"use client";

import { TriangleAlert } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "./button";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "danger" | "default";
};

export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const dialog = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    dialog.current?.showModal();
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    dialog.current?.close();
  };

  const element = (
    <dialog
      aria-label={options?.title ?? "确认"}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-xl border border-border-strong bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/70"
      ref={dialog}
      onCancel={() => {
        resolver.current?.(false);
        resolver.current = null;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          settle(false);
        }
      }}
    >
      <div className="flex gap-3 p-5">
        {options?.tone === "danger" ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-danger/40 bg-danger/10 text-danger">
            <TriangleAlert aria-hidden="true" className="size-4" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-semibold">{options?.title}</h2>
          {options?.description ? (
            <p className="mt-2 text-sm leading-6 text-muted">{options.description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border bg-surface-2/50 px-5 py-3">
        <Button size="sm" type="button" variant="ghost" onClick={() => settle(false)}>
          取消
        </Button>
        <Button
          autoFocus
          size="sm"
          type="button"
          variant={options?.tone === "danger" ? "danger" : "default"}
          onClick={() => settle(true)}
        >
          {options?.confirmLabel ?? "确认"}
        </Button>
      </div>
    </dialog>
  );

  return [confirm, element];
}
