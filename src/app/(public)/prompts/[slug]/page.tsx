import { ArrowLeft, Info, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/card";
import { TrackView } from "@/features/analytics/components/track-view";
import { galleryHref } from "@/features/prompts/gallery-query";
import { GalleryCard } from "@/features/prompts/components/gallery-card";
import { Lightbox } from "@/features/prompts/components/lightbox";
import { PromptBlock } from "@/features/prompts/components/prompt-block";
import { ShareButton } from "@/features/prompts/components/share-button";
import { getPublishedPromptCached } from "@/features/prompts/server/queries";
import { listRelatedPrompts } from "@/features/prompts/server/service";
import { getDatabase } from "@/server/db/client";
import { getEnv } from "@/server/env";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

function describe(prompt: { summary: string | null; promptText: string }) {
  return prompt.summary ?? prompt.promptText.slice(0, 160);
}

export async function generateMetadata({ params }: Context): Promise<Metadata> {
  const prompt = await getPublishedPromptCached((await params).slug);
  if (!prompt) {
    return { title: "未找到 · Prompt Gallery" };
  }
  const origin = new URL(getEnv().APP_URL).origin;
  const description = describe(prompt);
  return {
    title: `${prompt.title} · Prompt Gallery`,
    description,
    alternates: { canonical: `${origin}/prompts/${prompt.slug}` },
    openGraph: {
      title: prompt.title,
      description,
      images: prompt.images[0]
        ? [`${origin}/api/v1/media/${prompt.images[0].id}/detail`]
        : undefined,
    },
  };
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
      <dt className="font-mono text-[11px] tracking-wide text-muted uppercase">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-foreground/90">{children}</dd>
    </div>
  );
}

export default async function PromptPage({ params }: Context) {
  const prompt = await getPublishedPromptCached((await params).slug);
  if (!prompt) {
    notFound();
  }
  const related = await listRelatedPrompts(getDatabase(), prompt.id);
  const path = `/prompts/${prompt.slug}`;
  const origin = new URL(getEnv().APP_URL).origin;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: prompt.title,
    description: describe(prompt),
    text: prompt.promptText,
    url: `${origin}${path}`,
    ...(prompt.sourceAuthor
      ? { creator: { "@type": "Person", name: prompt.sourceAuthor } }
      : {}),
    image: prompt.images.map((image) => ({
      "@type": "ImageObject",
      contentUrl: `${origin}/api/v1/media/${image.id}/detail`,
      width: image.width,
      height: image.height,
    })),
  };

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:py-10">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <TrackView kind="detail_view" path={path} promptId={prompt.id} />
      <nav aria-label="面包屑" className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground" href="/">
          <ArrowLeft aria-hidden="true" className="size-4" />
          图片库
        </Link>
        {prompt.category ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              className="inline-flex min-h-11 items-center hover:text-foreground"
              href={galleryHref({ q: "", category: prompt.category.slug, model: "", tags: [] })}
            >
              {prompt.category.name}
            </Link>
          </>
        ) : null}
      </nav>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          {prompt.images.length > 0 ? (
            <Lightbox images={prompt.images} title={prompt.title} />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted">
              暂无可显示的图片
            </div>
          )}
        </div>
        <article className="flex min-w-0 flex-col gap-6">
          <header className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {prompt.model ? (
                <Badge tone="accent">
                  {prompt.model.name}
                  {prompt.modelVersion ? ` ${prompt.modelVersion}` : ""}
                </Badge>
              ) : null}
              {prompt.aspectRatio ? <Badge>{prompt.aspectRatio}</Badge> : null}
              {prompt.images.length > 1 ? <Badge>{prompt.images.length} 张</Badge> : null}
            </div>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
              {prompt.title}
            </h1>
            {prompt.summary ? <p className="leading-7 text-muted">{prompt.summary}</p> : null}
            {prompt.tags.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {prompt.tags.map((tag) => (
                  <li key={tag.slug}>
                    <Link
                      className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs text-muted transition-colors hover:border-accent/50 hover:text-accent"
                      href={galleryHref({ q: "", category: "", model: "", tags: [tag.slug] })}
                    >
                      #{tag.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </header>
          {prompt.requiresReference ? (
            <p className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              这条提示词需要参考图，只复制文字可能无法复现。
            </p>
          ) : null}
          <PromptBlock
            emphasis
            event={{ kind: "prompt_copy", promptId: prompt.id, path }}
            label="Prompt"
            text={prompt.promptText}
          />
          {prompt.negativePrompt ? (
            <PromptBlock label="Negative" text={prompt.negativePrompt} />
          ) : null}
          {prompt.parametersText ? (
            <PromptBlock label="Parameters" text={prompt.parametersText} />
          ) : null}
          {prompt.usageNotes ? (
            <section className="grid gap-2">
              <Eyebrow>使用说明</Eyebrow>
              <p className="leading-7 whitespace-pre-wrap text-foreground/90">{prompt.usageNotes}</p>
            </section>
          ) : null}
          <section aria-label="规格" className="grid gap-2">
            <Eyebrow>规格</Eyebrow>
            <dl className="overflow-hidden rounded-xl border border-border bg-surface/60">
              <SpecRow label="分类">{prompt.category?.name ?? "未分类"}</SpecRow>
              <SpecRow label="模型">
                <span className="font-mono">
                  {prompt.model?.name ?? "未标注"}
                  {prompt.modelVersion ? ` · ${prompt.modelVersion}` : ""}
                </span>
              </SpecRow>
              {prompt.aspectRatio ? (
                <SpecRow label="比例">
                  <span className="font-mono">{prompt.aspectRatio}</span>
                </SpecRow>
              ) : null}
              <SpecRow label="来源">{prompt.sourceType === "original" ? "原创" : "收集"}</SpecRow>
              {prompt.sourceAuthor ? <SpecRow label="作者">{prompt.sourceAuthor}</SpecRow> : null}
              {prompt.sourceUrl ? (
                <SpecRow label="链接">
                  <a
                    className="text-accent underline-offset-4 hover:underline"
                    href={prompt.sourceUrl}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    {prompt.sourceUrl}
                  </a>
                </SpecRow>
              ) : null}
              {prompt.publishedAt ? (
                <SpecRow label="发布">
                  <time className="font-mono" dateTime={prompt.publishedAt}>
                    {prompt.publishedAt.slice(0, 10)}
                  </time>
                </SpecRow>
              ) : null}
            </dl>
          </section>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ShareButton path={path} title={prompt.title} />
            <p className="flex max-w-xs items-start gap-1.5 text-xs leading-5 text-muted">
              <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              生成效果可能因模型版本、参数与随机性不同而变化。
            </p>
          </div>
        </article>
      </div>
      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="mt-16 grid gap-4">
          <div>
            <Eyebrow>Related</Eyebrow>
            <h2 className="mt-1 text-xl font-semibold" id="related-heading">
              相关推荐
            </h2>
          </div>
          <ul className="grid grid-cols-2 items-start gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {related.map((card) => (
              <li key={card.id}>
                <GalleryCard card={card} titleAs="h3" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
