"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-mono text-xs tracking-[0.2em] text-danger uppercase">Error</p>
      <h1 className="mt-4 text-2xl font-semibold">页面暂时无法显示</h1>
      <p className="mt-3 text-muted">可能是网络或服务短暂异常，请稍后重试。</p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[11px] text-muted">ref: {error.digest}</p>
      ) : null}
      <div className="mt-8 flex gap-3">
        <Button type="button" onClick={() => retry()}>
          <RotateCw aria-hidden="true" className="size-4" />
          重试
        </Button>
        <Button asChild variant="outline">
          <Link href="/">回到图片库</Link>
        </Button>
      </div>
    </main>
  );
}
