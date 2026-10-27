"use client";

import { ArrowDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PromptCard, PromptCardPage } from "../types";
import { GalleryCard } from "./gallery-card";
import { MasonryGrid, MasonryItem } from "./masonry-grid";

type Saved = { startPage: number; loadedThrough: number; scrollY: number };

const PRIORITY_COUNT = 6;

let popped = { at: 0, href: "" };
let documentLoadHref: string | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    popped = { at: Date.now(), href: window.location.href };
  });
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (entry?.type === "back_forward" || entry?.type === "reload") {
    documentLoadHref = window.location.href;
  }
}

/**
 * Only back/forward and reload should restore a saved feed position. The check
 * must be repeatable because Strict Mode runs the mount effect twice.
 */
function hasRestoreIntent(): boolean {
  const href = window.location.href;
  return (
    (Date.now() - popped.at < 2000 && popped.href === href) ||
    (documentLoadHref === href && performance.now() < 10_000)
  );
}

function storageKey(query: string): string {
  return `gallery-feed:${query}`;
}

function readSaved(query: string): Saved | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(query));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function writeSaved(query: string, saved: Saved) {
  try {
    window.sessionStorage.setItem(storageKey(query), JSON.stringify(saved));
  } catch {
    // Storage may be full or disabled; restoring position is best effort.
  }
}

function merge(current: PromptCard[], next: PromptCard[]): PromptCard[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}

export function GalleryFeed({
  initial,
  query,
}: {
  initial: PromptCardPage;
  query: string;
}) {
  const [items, setItems] = useState(initial.items);
  const [loadedThrough, setLoadedThrough] = useState(initial.page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(initial.page);
  const hasMore = loadedThrough * initial.pageSize < initial.total;
  const nextParams = new URLSearchParams(query);
  nextParams.set("page", String(loadedThrough + 1));
  const nextHref = `/?${nextParams.toString()}`;

  const fetchPage = useCallback(
    async (page: number): Promise<PromptCardPage> => {
      const params = new URLSearchParams(query);
      params.set("page", String(page));
      params.set("pageSize", String(initial.pageSize));
      const response = await fetch(`/api/v1/prompts?${params.toString()}`);
      if (!response.ok) {
        throw new Error("load failed");
      }
      const payload = (await response.json()) as { data: PromptCardPage };
      return payload.data;
    },
    [query, initial.pageSize],
  );

  const save = useCallback(() => {
    writeSaved(query, {
      startPage: initial.page,
      loadedThrough: loadedRef.current,
      scrollY: window.scrollY,
    });
  }, [initial.page, query]);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    let cancelled = false;
    const saved = hasRestoreIntent() ? readSaved(query) : null;

    async function restore() {
      if (!saved || saved.startPage !== initial.page) {
        return;
      }
      let collected: PromptCard[] = [];
      let reached = initial.page;
      for (let page = initial.page + 1; page <= saved.loadedThrough; page += 1) {
        try {
          const next = await fetchPage(page);
          collected = [...collected, ...next.items];
          reached = page;
        } catch {
          break;
        }
      }
      if (cancelled) {
        return;
      }
      if (collected.length > 0) {
        loadedRef.current = reached;
        setLoadedThrough(reached);
        setItems((current) => merge(current, collected));
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
      });
    }
    void restore();

    // The next page resets scroll to the top before this feed unmounts; those
    // scroll events belong to the new URL and must not overwrite the position.
    const ownHref = window.location.href;
    const saveOwn = () => {
      if (window.location.href === ownHref) {
        save();
      }
    };
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(saveOwn);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", saveOwn);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", saveOwn);
      window.history.scrollRestoration = previous;
    };
  }, [fetchPage, initial.page, query, save]);

  async function loadMore(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchPage(loadedRef.current + 1);
      loadedRef.current += 1;
      setLoadedThrough(loadedRef.current);
      setItems((current) => merge(current, next.items));
      save();
    } catch {
      setError("加载失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <MasonryGrid>
        {items.map((item, index) => (
          <MasonryItem key={item.id}>
            <GalleryCard card={item} priority={index < PRIORITY_COUNT && initial.page === 1} />
          </MasonryItem>
        ))}
      </MasonryGrid>
      <div className="mt-10 flex flex-col items-center gap-3">
        <p className="font-mono text-xs text-muted">
          {items.length} / {initial.total}
        </p>
        {hasMore ? (
          <Button asChild variant="outline">
            <a aria-busy={loading || undefined} href={nextHref} onClick={loadMore}>
              <ArrowDown aria-hidden="true" className={loading ? "size-4 animate-bounce" : "size-4"} />
              {loading ? "正在加载" : "加载更多"}
            </a>
          </Button>
        ) : (
          <p className="text-xs text-muted">已经到底了</p>
        )}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
