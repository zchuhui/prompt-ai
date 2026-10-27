"use client";

import { useEffect, useRef } from "react";

export function MeasuredCard({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () => {
      const height = element.getBoundingClientRect().height;
      element.style.gridRowEnd = `span ${Math.max(1, Math.ceil((height + 12) / 8))}`;
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, []);

  return (
    <article ref={ref} className="gallery-card min-w-0">
      {children}
    </article>
  );
}
