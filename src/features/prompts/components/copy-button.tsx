"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label,
  event,
}: {
  text: string;
  label: string;
  event?: { kind: "prompt_copy"; promptId: string; path: string };
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setManual(false);
      setMessage("已复制");
      if (event) {
        void fetch("/api/v1/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            eventId: crypto.randomUUID(),
            kind: event.kind,
            promptId: event.promptId,
            path: event.path,
          }),
        });
      }
    } catch {
      setManual(true);
      setMessage("无法写入剪贴板，请手动选择文本");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        className="min-h-11 w-fit rounded-md bg-accent px-4 text-sm text-background"
        type="button"
        onClick={copy}
      >
        {label}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {manual ? (
        <textarea className="min-h-28 w-full border border-border bg-background p-3" readOnly value={text} />
      ) : null}
    </div>
  );
}
