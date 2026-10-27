"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { writeClipboard } from "./prompt-block";

export function ShareButton({ title, path }: { title: string; path: string }) {
  const toast = useToast();
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
    if (await writeClipboard(url)) {
      setManualUrl(null);
      toast("链接已复制", "success");
      return;
    }
    setManualUrl(url);
  }

  return (
    <div className="grid gap-2">
      <Button className="w-fit" size="sm" type="button" variant="outline" onClick={share}>
        <Share2 aria-hidden="true" className="size-4" />
        分享
      </Button>
      {manualUrl ? (
        <input
          aria-label="分享链接（手动复制）"
          autoFocus
          className="min-h-10 w-full rounded-md border border-border-strong bg-background px-3 font-mono text-xs"
          readOnly
          value={manualUrl}
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}
