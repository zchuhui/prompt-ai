import { ArrowLeft, Eye, ImageOff, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PromptBlock } from "@/features/prompts/components/prompt-block";
import { StatusBadge } from "@/features/prompts/components/status-badge";
import { getAdminPrompt } from "@/features/prompts/server/service";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "预览 · Prompt Gallery",
  robots: { index: false, follow: false },
};

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const prompt = await getAdminPrompt(getDatabase(), (await params).id).catch(() => null);
  if (!prompt) {
    notFound();
  }
  const images = [...prompt.assetItems].sort((a, b) =>
    a.assetId === prompt.coverAssetId ? -1 : b.assetId === prompt.coverAssetId ? 1 : 0,
  );
  return (
    <article className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
        <Eye aria-hidden="true" className="size-4 text-accent" />
        <span className="min-w-0 flex-1">后台预览，按当前已保存的版本渲染，访客看不到草稿。</span>
        <StatusBadge status={prompt.status} />
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/prompts/${prompt.id}/edit`}>
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            回到编辑
          </Link>
        </Button>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="grid gap-3">
          {images.length === 0 ? (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong text-sm text-muted">
              <ImageOff aria-hidden="true" className="size-5" />
              还没有图片
            </div>
          ) : (
            images.map((item) =>
              item.status === "ready" ? (
                <img
                  alt={item.alt ?? prompt.title}
                  className="w-full rounded-2xl border border-border bg-surface"
                  height={item.height ?? undefined}
                  key={item.assetId}
                  src={`/api/v1/admin/media/${item.assetId}/detail`}
                  width={item.width ?? undefined}
                />
              ) : (
                <div
                  className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-border bg-surface-2 text-sm text-muted"
                  key={item.assetId}
                >
                  {item.status === "failed" ? "图片处理失败" : "图片处理中"}
                </div>
              ),
            )
          )}
        </div>

        <div className="grid gap-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{prompt.title || "未命名草稿"}</h1>
            {prompt.summary ? <p className="mt-3 text-sm leading-6 text-muted">{prompt.summary}</p> : null}
            {prompt.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {prompt.tags.map((tag) => (
                  <Badge key={tag.id}>#{tag.name}</Badge>
                ))}
              </div>
            ) : null}
          </div>
          {prompt.requiresReference ? (
            <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
              <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
              需要参考图
            </p>
          ) : null}
          {prompt.promptText ? (
            <PromptBlock emphasis label="Prompt" text={prompt.promptText} />
          ) : (
            <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">
              还没有填写主 Prompt
            </p>
          )}
          {prompt.negativePrompt ? <PromptBlock label="Negative" text={prompt.negativePrompt} /> : null}
          {prompt.parametersText ? <PromptBlock label="Parameters" text={prompt.parametersText} /> : null}
          {prompt.usageNotes ? (
            <section>
              <h2 className="text-sm font-semibold">使用说明</h2>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-muted">{prompt.usageNotes}</p>
            </section>
          ) : null}
        </div>
      </div>
    </article>
  );
}
