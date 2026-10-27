import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/card";
import { TrackView } from "@/features/analytics/components/track-view";
import { ActiveFilters, FilterBar } from "@/features/prompts/components/filter-bar";
import { GalleryCard } from "@/features/prompts/components/gallery-card";
import { GalleryFeed } from "@/features/prompts/components/gallery-feed";
import { galleryQuery, isFiltered, parseGalleryParams } from "@/features/prompts/gallery-query";
import {
  countPublishedPrompts,
  listFilters,
  searchPublishedPrompts,
} from "@/features/prompts/server/queries";
import { parsePage, parsePageSize } from "@/shared/pagination";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value) || undefined;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const params = parseGalleryParams(await searchParams);
  return {
    title: "图片库 · Prompt Gallery",
    description: "浏览效果图，找到感兴趣的内容，查看提示词并复制使用。",
    robots: isFiltered(params) ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const raw = await searchParams;
  const params = parseGalleryParams(raw);
  const page = parsePage(one(raw.page));
  const pageSize = parsePageSize(one(raw.pageSize));
  const filtered = isFiltered(params);
  const db = getDatabase();
  const [filters, result, totalPublished] = await Promise.all([
    listFilters(db),
    searchPublishedPrompts(db, {
      q: params.q || undefined,
      categorySlug: params.category || undefined,
      modelSlug: params.model || undefined,
      tagSlugs: params.tags,
      page,
      pageSize,
    }),
    countPublishedPrompts(db),
  ]);
  const latest =
    result.total === 0 && filtered
      ? await searchPublishedPrompts(db, { tagSlugs: [], page: 1, pageSize: 8 })
      : null;
  const query = galleryQuery(params);

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 pt-10 pb-16 md:px-6 md:pt-14">
      <TrackView
        kind={params.q && result.total === 0 ? "search_empty" : params.q ? "search" : "page_view"}
        path="/"
        query={params.q || undefined}
      />
      <section className="max-w-3xl">
        <Eyebrow>Prompt Gallery · 图片生成灵感库</Eyebrow>
        <h1 className="mt-4 text-3xl leading-tight font-semibold tracking-tight md:text-5xl">
          <span className="text-gradient">找到画面，复制提示词。</span>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted">
          每条内容都附带原文 Prompt、模型与参数。看中哪张图，打开就能复制使用。
        </p>
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted">
          <div className="flex gap-2">
            <dt>收录</dt>
            <dd className="text-foreground">{totalPublished}</dd>
          </div>
          <div className="flex gap-2">
            <dt>模型</dt>
            <dd className="text-foreground">{filters.models.length}</dd>
          </div>
          <div className="flex gap-2">
            <dt>标签</dt>
            <dd className="text-foreground">{filters.tags.length}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <FilterBar options={filters} params={params} />
        {filtered ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="font-mono text-xs text-muted">
              找到 <span className="text-accent">{result.total}</span> 条
            </p>
            <ActiveFilters options={filters} params={params} />
          </div>
        ) : null}
      </section>

      <section aria-label="图片列表" className="mt-8">
        {result.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface/40 px-6 py-12 text-center">
            <p className="text-lg font-medium">没有符合当前条件的内容</p>
            <p className="mt-2 text-sm text-muted">
              {filtered ? "换个关键词，或者去掉部分条件再试试。" : "还没有公开内容，稍后再来看看。"}
            </p>
            {filtered ? (
              <ActiveFilters className="mt-5 justify-center" options={filters} params={params} />
            ) : null}
            {page > 1 && !filtered ? (
              <Link className="mt-5 inline-block text-sm text-accent" href="/">
                回到第一页
              </Link>
            ) : null}
          </div>
        ) : (
          <GalleryFeed initial={result} key={`${query}|${page}`} query={query} />
        )}
        {latest && latest.items.length > 0 ? (
          <div className="mt-12">
            <Eyebrow>Latest</Eyebrow>
            <h2 className="mt-2 text-lg font-medium">看看最新收录</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {latest.items.map((item) => (
                <GalleryCard card={item} key={item.id} titleAs="h3" />
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
