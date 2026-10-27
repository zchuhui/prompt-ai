"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/components/ui/utils";

const ROW_HEIGHT = 4;

function gapOf(grid: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
}

export function MasonryGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const grid = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = grid.current;
    if (!node) {
      return;
    }
    const layout = (items: Element[]) => {
      const gap = gapOf(node);
      for (const item of items) {
        const content = item.firstElementChild;
        if (!(item instanceof HTMLElement) || !content) {
          continue;
        }
        const height = content.getBoundingClientRect().height;
        item.style.gridRowEnd = `span ${Math.max(1, Math.ceil((height + gap) / ROW_HEIGHT))}`;
      }
    };
    const observer = new ResizeObserver((entries) => {
      layout(entries.map((entry) => entry.target.parentElement).filter((item) => item !== null));
    });
    const observe = () => {
      const items = [...node.children];
      for (const item of items) {
        if (item.firstElementChild) {
          observer.observe(item.firstElementChild);
        }
      }
      layout(items);
      node.dataset.masonry = "ready";
    };
    observe();
    const mutations = new MutationObserver(observe);
    mutations.observe(node, { childList: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);

  return (
    <div className={cn("gallery-grid", className)} data-masonry="pending" ref={grid}>
      {children}
    </div>
  );
}

export function MasonryItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div>{children}</div>
    </div>
  );
}
