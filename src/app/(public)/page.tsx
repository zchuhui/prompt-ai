import type { Metadata } from "next";
import Link from "next/link";
import { TrackView } from "@/features/analytics/components/track-view";
import { MeasuredCard } from "@/features/prompts/components/measured-card";
import { RestoreScroll } from "@/features/prompts/components/restore-scroll";
import { listFilters, searchPublishedPrompts } from "@/features/prompts/server/queries";
import { parsePage, parsePageSize } from "@/shared/pagination";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Boolean(one(params.q) || one(params.category) || one(params.model) || one(params.tags));
  return {
    title: "图片库 · Prompt Gallery",
    description: "浏览效果图，找到感兴趣的内容，查看提示词并复制使用。",
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const q = one(params.q).slice(0, 100);
  const category = one(params.category);
  const model = one(params.model);
  const tags = one(params.tags);
  const page = parsePage(one(params.page) || undefined);
  const pageSize = parsePageSize(one(params.pageSize) || undefined);
  const db = getDatabase();
  const [filters, result] = await Promise.all([
    listFilters(db),
    searchPublishedPrompts(db, {
      q: q || undefined,
      categorySlug: category || undefined,
      modelSlug: model || undefined,
      tagSlugs: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      page,
      pageSize,
    }),
  ]);
  const next = new URLSearchParams();
  if (q) next.set("q", q);
  if (category) next.set("category", category);
  if (model) next.set("model", model);
  if (tags) next.set("tags", tags);
  next.set("page", String(page + 1));
  const hasMore = page * pageSize < result.total;

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-6 py-8">
      <RestoreScroll />
      <TrackView
        kind={q && result.total === 0 ? "search_empty" : q ? "search" : "page_view"}
        path="/"
        query={q || undefined}
      />
      <h1 className="text-3xl font-semibold tracking-tight">图片库</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
        浏览效果图，找到感兴趣的内容，查看提示词并复制使用。
      </p>
      <form className="mt-6 grid gap-3 md:grid-cols-4" method="get">
        <label className="flex flex-col gap-2 text-sm">
          搜索
          <input className="min-h-11 border border-border bg-background px-3" defaultValue={q} name="q" />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          分类
          <select className="min-h-11 border border-border bg-background px-3" defaultValue={category} name="category">
            <option value="">全部</option>
            {filters.categories.map((item) => (
              <option key={item.id} value={item.slug}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          模型
          <select className="min-h-11 border border-border bg-background px-3" defaultValue={model} name="model">
            <option value="">全部</option>
            {filters.models.map((item) => (
              <option key={item.id} value={item.slug}>{item.name}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="min-h-11 rounded-md bg-accent px-4 text-sm text-background" type="submit">
            筛选
          </button>
          <Link className="inline-flex min-h-11 items-center px-3 text-sm" href="/">
            清空
          </Link>
        </div>
        <fieldset className="md:col-span-4">
          <legend className="text-sm">标签</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {filters.tags.map((tag) => {
              const selected = tags.split(",").includes(tag.slug);
              const nextTags = selected
                ? tags.split(",").filter((item) => item && item !== tag.slug)
                : [...tags.split(",").filter(Boolean), tag.slug];
              const query = new URLSearchParams();
              if (q) query.set("q", q);
              if (category) query.set("category", category);
              if (model) query.set("model", model);
              if (nextTags.length > 0) query.set("tags", nextTags.join(","));
              return (
                <Link
                  className={`inline-flex min-h-11 items-center border px-3 text-sm ${selected ? "border-accent text-accent" : "border-border"}`}
                  href={`/?${query.toString()}`}
                  key={tag.id}
                >
                  {tag.name}
                </Link>
              );
            })}
          </div>
        </fieldset>
      </form>
      {result.items.length === 0 ? (
        <p className="mt-10 text-muted">没有符合当前条件的内容。</p>
      ) : (
        <div className="gallery-grid mt-8">
          {result.items.map((item) => (
            <MeasuredCard key={item.id}>
              <Link href={`/prompts/${item.slug}`}>
                {item.cover ? (
                  <img
                    alt={item.cover.alt ?? item.title}
                    height={item.cover.height}
                    src={`/api/v1/media/${item.cover.id}/card`}
                    width={item.cover.width}
                  />
                ) : (
                  <div className="aspect-square bg-border" />
                )}
                <h2 className="mt-3 text-base font-medium">{item.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {item.modelName ?? "未标注模型"}
                  {item.imageCount > 1 ? ` · ${item.imageCount} 张` : ""}
                </p>
              </Link>
            </MeasuredCard>
          ))}
        </div>
      )}
      {hasMore ? (
        <Link className="mt-8 inline-flex min-h-11 items-center text-sm text-accent" href={`/?${next.toString()}`}>
          加载更多
        </Link>
      ) : null}
    </main>
  );
}
