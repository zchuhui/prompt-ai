"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/utils";
import { cardRatio, mediaSrc } from "./gallery-card";

type Image = { id: string; alt: string | null; width: number; height: number };

const SWIPE_DISTANCE = 40;

function useSwipe(onSwipe: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  return {
    consumeSwipe() {
      const value = swiped.current;
      swiped.current = false;
      return value;
    },
    handlers: {
      onPointerDown(event: React.PointerEvent) {
        start.current = { x: event.clientX, y: event.clientY };
        swiped.current = false;
      },
      onPointerUp(event: React.PointerEvent) {
        const origin = start.current;
        start.current = null;
        if (!origin) {
          return;
        }
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
          swiped.current = true;
          onSwipe(dx < 0 ? 1 : -1);
        }
      },
      onPointerCancel() {
        start.current = null;
      },
    },
  };
}

function NavButton({
  direction,
  onClick,
  className,
}: {
  direction: 1 | -1;
  onClick: () => void;
  className?: string;
}) {
  const Icon = direction === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      aria-label={direction === 1 ? "下一张" : "上一张"}
      className={cn(
        "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur transition-colors hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        direction === 1 ? "right-3" : "left-3",
        className,
      )}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}

export function Lightbox({ images, title }: { images: Image[]; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;
  const current = images[index];

  const step = useCallback(
    (direction: 1 | -1) => setIndex((value) => (value + direction + count) % count),
    [count],
  );
  const inline = useSwipe(step);
  const modal = useSwipe(step);

  useEffect(() => {
    const node = dialog.current;
    if (!node || count < 2) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [count, step]);

  if (!current) {
    return null;
  }

  const alt = current.alt ?? title;
  const counter = `${index + 1} / ${count}`;

  return (
    <div className="grid gap-3">
      <div
        className="relative overflow-hidden rounded-2xl border border-border bg-surface-2 select-none"
        style={{ aspectRatio: cardRatio(current), maxHeight: "78vh", touchAction: "pan-y" }}
        {...inline.handlers}
      >
        <button
          aria-label={`放大查看：${alt}`}
          className="group absolute inset-0 block cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-inset"
          type="button"
          onClick={() => {
            if (!inline.consumeSwipe()) {
              dialog.current?.showModal();
            }
          }}
        >
          <img
            alt={alt}
            className="fade-in size-full object-contain"
            draggable={false}
            fetchPriority="high"
            height={current.height}
            key={current.id}
            src={mediaSrc(current.id, "detail")}
            width={current.width}
          />
          <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md border border-white/15 bg-black/55 px-2 py-1 font-mono text-[11px] text-white/85 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2 aria-hidden="true" className="size-3" />
            放大
          </span>
        </button>
        {count > 1 ? (
          <>
            <NavButton direction={-1} onClick={() => step(-1)} />
            <NavButton direction={1} onClick={() => step(1)} />
            <span className="pointer-events-none absolute top-3 left-3 rounded-md border border-white/15 bg-black/55 px-2 py-0.5 font-mono text-[11px] text-white/90 backdrop-blur">
              {counter}
            </span>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {images.map((image, imageIndex) => (
            <button
              aria-current={imageIndex === index ? "true" : undefined}
              aria-label={`第 ${imageIndex + 1} 张`}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg border bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                imageIndex === index
                  ? "border-accent shadow-[0_0_0_1px_rgb(34_211_238/0.4)]"
                  : "border-border opacity-70 hover:opacity-100",
              )}
              key={image.id}
              type="button"
              onClick={() => setIndex(imageIndex)}
            >
              <img
                alt=""
                className="size-full object-cover"
                height={image.height}
                loading="lazy"
                src={mediaSrc(image.id, "card")}
                width={image.width}
              />
            </button>
          ))}
        </div>
      ) : null}
      <dialog
        aria-label={`${title} · 图片查看`}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 text-white"
        ref={dialog}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="font-mono text-xs text-white/70">{count > 1 ? counter : title}</span>
            <div className="flex items-center gap-2">
              <a
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-white/15 px-3 text-xs text-white/85 transition-colors hover:border-accent/60 hover:text-accent"
                href={mediaSrc(current.id, "original")}
                rel="noopener"
                target="_blank"
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
                查看原图
              </a>
              <button
                aria-label="关闭"
                className="inline-flex size-10 items-center justify-center rounded-md border border-white/15 text-white/85 transition-colors hover:border-accent/60 hover:text-accent"
                type="button"
                onClick={() => dialog.current?.close()}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
          <div
            className="relative min-h-0 flex-1 select-none"
            style={{ touchAction: "pan-y" }}
            {...modal.handlers}
          >
            <img
              alt={alt}
              className="fade-in absolute inset-0 m-auto max-h-full max-w-full object-contain p-2 sm:p-6"
              draggable={false}
              height={current.height}
              key={current.id}
              src={mediaSrc(current.id, "detail")}
              width={current.width}
            />
            {count > 1 ? (
              <>
                <NavButton direction={-1} onClick={() => step(-1)} />
                <NavButton direction={1} onClick={() => step(1)} />
              </>
            ) : null}
          </div>
          {current.alt ? (
            <p className="px-4 pb-4 text-center text-xs text-white/60">{current.alt}</p>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
