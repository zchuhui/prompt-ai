"use client";

import { useEffect } from "react";

export function TrackView({
  kind,
  path,
  promptId,
  query,
}: {
  kind: "page_view" | "detail_view" | "search" | "search_empty";
  path: string;
  promptId?: string;
  query?: string;
}) {
  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) {
      return;
    }
    void fetch("/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: crypto.randomUUID(),
        kind,
        path,
        promptId,
        query,
      }),
    });
  }, [kind, path, promptId, query]);
  return null;
}
