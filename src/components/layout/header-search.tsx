"use client";

import { Search } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/components/ui/utils";

export function HeaderSearch({ className, shortcut = true }: { className?: string; shortcut?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const params = useSearchParams();
  const pathname = usePathname();
  const q = params.get("q") ?? "";
  const onGallery = pathname === "/";

  useEffect(() => {
    if (!shortcut || onGallery) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut, onGallery]);

  if (onGallery && shortcut) {
    return null;
  }

  return (
    <form action="/" className={cn("relative", className)} method="get" role="search">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
      />
      <input
        aria-label="搜索提示词"
        className="min-h-10 w-full rounded-lg border border-border-strong bg-surface/70 pr-10 pl-9 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        defaultValue={q}
        key={q}
        maxLength={100}
        name="q"
        placeholder="搜索标题、提示词或标签"
        ref={input}
        type="search"
      />
      {shortcut ? (
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-border-strong px-1.5 font-mono text-[11px] text-muted md:inline">
          /
        </kbd>
      ) : null}
    </form>
  );
}
