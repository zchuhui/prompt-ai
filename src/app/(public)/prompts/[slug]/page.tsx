import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackView } from "@/features/analytics/components/track-view";
import { CopyButton } from "@/features/prompts/components/copy-button";
import { Lightbox } from "@/features/prompts/components/lightbox";
import { getPublishedPrompt } from "@/features/prompts/server/queries";
import { listRelatedPrompts } from "@/features/prompts/server/service";
import { getDatabase } from "@/server/db/client";
import { getEnv } from "@/server/env";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Context): Promise<Metadata> {
  const prompt = await getPublishedPrompt(getDatabase(), (await params).slug);
  if (!prompt) {
    return { title: "未找到 · Prompt Gallery" };
  }
  const origin = new URL(getEnv().APP_URL).origin;
  return {
    title: `${prompt.title} · Prompt Gallery`,
    description: prompt.summary ?? prompt.promptText.slice(0, 160),
    alternates: { canonical: `${origin}/prompts/${prompt.slug}` },
    openGraph: {
      title: prompt.title,
      description: prompt.summary ?? undefined,
      images: prompt.images[0]
        ? [`${origin}/api/v1/media/${prompt.images[0].id}/detail`]
        : undefined,
    },
  };
}

export default async function PromptPage({ params }: Context) {
  const slug = (await params).slug;
  const db = getDatabase();
  const prompt = await getPublishedPrompt(db, slug);
  if (!prompt) {
    notFound();
  }
  const related = await listRelatedPrompts(db, prompt.id);
  const path = `/prompts/${prompt.slug}`;
  const origin = new URL(getEnv().APP_URL).origin;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: prompt.title,
    description: prompt.summary ?? undefined,
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
    <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-10 px-6 py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <TrackView kind="detail_view" path={path} promptId={prompt.id} />
      <Lightbox images={prompt.images} />
      <article className="flex flex-col gap-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">{prompt.title}</h1>
          {prompt.summary ? <p className="mt-3 leading-7 text-muted">{prompt.summary}</p> : null}
          <p className="mt-3 text-sm text-muted">
            {prompt.category?.name ?? "未分类"} · {prompt.model?.name ?? "未标注模型"}
            {prompt.modelVersion ? ` ${prompt.modelVersion}` : ""}
            {prompt.aspectRatio ? ` · ${prompt.aspectRatio}` : ""}
          </p>
          {prompt.requiresReference ? (
            <p className="mt-2 text-sm text-accent">这条提示词需要参考图，只复制文字可能无法复现。</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {prompt.tags.map((tag) => (
              <Link className="border border-border px-2 py-1 text-sm" href={`/?tags=${tag.slug}`} key={tag.slug}>
                {tag.name}
              </Link>
            ))}
          </div>
        </header>
        <section>
          <h2 className="text-lg font-medium">主提示词</h2>
          <pre className="mt-3 whitespace-pre-wrap border border-border p-4 text-sm leading-6">{prompt.promptText}</pre>
          <div className="mt-3">
            <CopyButton event={{ kind: "prompt_copy", promptId: prompt.id, path }} label="复制 Prompt" text={prompt.promptText} />
          </div>
        </section>
        {prompt.negativePrompt ? (
          <section>
            <h2 className="text-lg font-medium">负面提示词</h2>
            <pre className="mt-3 whitespace-pre-wrap border border-border p-4 text-sm leading-6">{prompt.negativePrompt}</pre>
            <div className="mt-3">
              <CopyButton label="复制负面提示词" text={prompt.negativePrompt} />
            </div>
          </section>
        ) : null}
        {prompt.parametersText ? (
          <section>
            <h2 className="text-lg font-medium">参数</h2>
            <pre className="mt-3 whitespace-pre-wrap border border-border p-4 text-sm leading-6">{prompt.parametersText}</pre>
            <div className="mt-3">
              <CopyButton label="复制参数" text={prompt.parametersText} />
            </div>
          </section>
        ) : null}
        {prompt.usageNotes ? (
          <section>
            <h2 className="text-lg font-medium">使用说明</h2>
            <p className="mt-3 whitespace-pre-wrap leading-7">{prompt.usageNotes}</p>
          </section>
        ) : null}
        <section className="text-sm text-muted">
          <p>来源：{prompt.sourceType === "original" ? "原创" : "收集"}</p>
          {prompt.sourceAuthor ? <p>作者：{prompt.sourceAuthor}</p> : null}
          {prompt.sourceUrl ? (
            <p>
              链接：
              <a className="underline" href={prompt.sourceUrl} rel="noreferrer noopener">
                {prompt.sourceUrl}
              </a>
            </p>
          ) : null}
          <p className="mt-3">生成效果可能因模型版本、参数与随机性不同而变化。</p>
        </section>
        {related.length > 0 ? (
          <section>
            <h2 className="text-lg font-medium">相关推荐</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {related.map((item) => (
                <li key={item.id}>
                  <Link href={`/prompts/${item.slug}`}>{item.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </main>
  );
}
