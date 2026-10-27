"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";

type CopyEvent = { kind: "prompt_copy"; promptId: string; path: string };

export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function track(event: CopyEvent) {
  void fetch("/api/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventId: crypto.randomUUID(), ...event }),
    keepalive: true,
  }).catch(() => {});
}

export function PromptBlock({
  label,
  text,
  event,
  emphasis = false,
}: {
  label: string;
  text: string;
  event?: CopyEvent;
  emphasis?: boolean;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);

  async function copy() {
    if (await writeClipboard(text)) {
      setManual(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast(`已复制${label}`, "success");
      if (event) {
        track(event);
      }
      return;
    }
    setManual(true);
    toast("无法写入剪贴板，请在下方手动选择文本", "error");
  }

  return (
    <section
      aria-label={label}
      className={cn(
        "overflow-hidden rounded-xl border bg-[#0a0c10]",
        emphasis ? "border-accent/30 shadow-[0_0_0_1px_rgb(165_239_179/0.06),0_12px_40px_-16px_rgb(165_239_179/0.35)]" : "border-border",
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] tracking-wide text-muted uppercase">
          <span aria-hidden="true" className="flex gap-1">
            <span className="size-2 rounded-full bg-border-strong" />
            <span className="size-2 rounded-full bg-border-strong" />
            <span className={cn("size-2 rounded-full", emphasis ? "bg-accent" : "bg-border-strong")} />
          </span>
          <span className="truncate">
            <span className={emphasis ? "text-accent" : "text-foreground/80"}>{label}</span>
            <span aria-hidden="true"> · </span>
            {text.length} chars
          </span>
        </div>
        <button
          aria-label={`复制${label}`}
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
            copied
              ? "border-success/40 bg-success/10 text-success"
              : emphasis
                ? "border-accent/40 bg-accent text-on-accent hover:bg-accent/90"
                : "border-border-strong bg-surface-2 text-foreground hover:border-accent/50 hover:text-accent",
          )}
          type="button"
          onClick={copy}
        >
          {copied ? (
            <Check aria-hidden="true" className="size-3.5" />
          ) : (
            <Copy aria-hidden="true" className="size-3.5" />
          )}
          {copied ? "已复制" : "复制"}
        </button>
      </header>
      <pre className="max-h-[28rem] overflow-auto px-4 py-3.5 font-mono text-[13px] leading-6 break-words whitespace-pre-wrap text-foreground/90">
        {text}
      </pre>
      {manual ? (
        <div className="border-t border-border p-3">
          <textarea
            aria-label={`${label}（手动复制）`}
            autoFocus
            className="min-h-28 w-full rounded-md border border-border-strong bg-background p-3 font-mono text-xs"
            readOnly
            value={text}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}
    </section>
  );
}
