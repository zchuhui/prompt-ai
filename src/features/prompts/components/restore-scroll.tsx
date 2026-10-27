"use client";

import { useEffect } from "react";

export function RestoreScroll() {
  useEffect(() => {
    const key = `gallery:${window.location.pathname}${window.location.search}`;
    const saved = window.sessionStorage.getItem(key);
    if (saved) {
      const parsed = Number(saved);
      if (Number.isFinite(parsed)) {
        window.scrollTo(0, parsed);
      }
    }
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const onScroll = () => {
      window.sessionStorage.setItem(key, String(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.history.scrollRestoration = previous;
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return null;
}
