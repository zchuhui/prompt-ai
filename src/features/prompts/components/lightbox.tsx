"use client";

import { useEffect, useRef, useState } from "react";

type Image = { id: string; alt: string | null; width: number; height: number };

export function Lightbox({ images }: { images: Image[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const current = images[index];

  useEffect(() => {
    const node = dialog.current;
    if (!node) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (!node.open) {
        return;
      }
      if (event.key === "ArrowRight") {
        setIndex((value) => (value + 1) % images.length);
      }
      if (event.key === "ArrowLeft") {
        setIndex((value) => (value - 1 + images.length) % images.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length]);

  if (!current) {
    return null;
  }

  return (
    <>
      <div className="grid gap-3">
        <button
          className="block"
          type="button"
          onClick={() => {
            dialog.current?.showModal();
          }}
        >
          <img
            alt={current.alt ?? ""}
            height={current.height}
            src={`/api/v1/media/${current.id}/detail`}
            width={current.width}
          />
        </button>
        {images.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {images.map((image, imageIndex) => (
              <button
                className="min-h-11 min-w-11 border border-border"
                key={image.id}
                type="button"
                onClick={() => setIndex(imageIndex)}
              >
                <img
                  alt={image.alt ?? ""}
                  className="h-16 w-16 object-contain"
                  height={image.height}
                  src={`/api/v1/media/${image.id}/card`}
                  width={image.width}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <dialog
        className="w-[min(960px,calc(100%-2rem))] bg-background p-4 text-foreground"
        ref={dialog}
      >
        <img
          alt={current.alt ?? ""}
          className="max-h-[80vh] w-full object-contain"
          height={current.height}
          src={`/api/v1/media/${current.id}/original`}
          width={current.width}
        />
        <div className="mt-3 flex gap-2">
          <button className="min-h-11 border border-border px-4" type="button" onClick={() => setIndex((value) => (value - 1 + images.length) % images.length)}>
            上一张
          </button>
          <button className="min-h-11 border border-border px-4" type="button" onClick={() => setIndex((value) => (value + 1) % images.length)}>
            下一张
          </button>
          <button className="min-h-11 border border-border px-4" type="button" onClick={() => dialog.current?.close()}>
            关闭
          </button>
        </div>
      </dialog>
    </>
  );
}
