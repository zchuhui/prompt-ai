import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Eyebrow } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { getPublicCollection } from "@/features/collections/server/service";
import { GalleryCard, mediaSrc } from "@/features/prompts/components/gallery-card";
import { MasonryGrid, MasonryItem } from "@/features/prompts/components/masonry-grid";
import { parsePage } from "@/shared/pagination";
import { getDatabase } from "@/server/db/client";
import { getEnv } from "@/server/env";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

type Context = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const loadCollection = cache((slug: string, page: number) =>
  getPublicCollection(getDatabase(), slug, page, PAGE_SIZE),
);

async function resolve({ params, searchParams }: Context) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const page = parsePage(Array.isArray(query.page) ? query.page[0] : query.page);
  return { page, collection: await loadCollection(slug, page) };
}

export async function generateMetadata(context: Context): Promise<Metadata> {
  const { page, collection } = await resolve(context);
  if (!collection) {
    return { title: "未找到 · Prompt Gallery" };
  }
  const origin = new URL(getEnv().APP_URL).origin;
  return {
    title: `${collection.title} · 专题合集 · Prompt Gallery`,
    description: collection.description ?? `${collection.title}，共 ${collection.total} 条提示词。`,
    alternates: { canonical: `${origin}/collections/${collection.slug}` },
    robots: page > 1 ? { index: false, follow: true } : undefined,
    openGraph: collection.cover
      ? { images: [`${origin}/api/v1/media/${collection.cover.id}/detail`] }
      : undefined,
  };
}

export default async function CollectionPage(context: Context) {
  const { page, collection } = await resolve(context);
  if (!collection) {
    notFound();
  }
  const totalPages = Math.max(1, Math.ceil(collection.total / collection.pageSize));
  const path = `/collections/${collection.slug}`;

  return (
    <main className="flex w-full flex-1 flex-col pb-16">
      <header className="relative isolate overflow-hidden border-b border-border">
        {collection.cover ? (
          <img
            alt=""
            className="absolute inset-0 -z-10 size-full scale-110 object-cover opacity-50 blur-2xl"
            src={mediaSrc(collection.cover.id, "card")}
          />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/30 via-background/70 to-background" />
        <div className="mx-auto w-full max-w-[1600px] px-4 pt-6 pb-10 md:px-6 md:pb-14">
          <Link
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-foreground"
            href="/collections"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            专题合集
          </Link>
          <Eyebrow className="mt-6">Collection</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            {collection.title}
          </h1>
          {collection.description ? (
            <p className="mt-4 max-w-2xl leading-7 whitespace-pre-line text-foreground/80">
              {collection.description}
            </p>
          ) : null}
          <p className="mt-5 font-mono text-xs text-muted">
            <span className="text-accent">{collection.total}</span> 条提示词
            {totalPages > 1 ? ` · 第 ${page} / ${totalPages} 页` : ""}
          </p>
        </div>
      </header>
      <section aria-label="合集内容" className="mx-auto mt-8 w-full max-w-[1600px] px-4 md:px-6">
        {collection.members.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface/40 px-6 py-12 text-center">
            <p className="text-lg font-medium">这一页没有内容</p>
            <Link className="mt-4 inline-block text-sm text-accent hover:underline" href={path}>
              回到第一页
            </Link>
          </div>
        ) : (
          <MasonryGrid>
            {collection.members.map((card, index) => (
              <MasonryItem key={card.id}>
                <GalleryCard card={card} priority={page === 1 && index < 4} />
              </MasonryItem>
            ))}
          </MasonryGrid>
        )}
        <Pagination
          className="mt-10"
          hrefFor={(value) => (value > 1 ? `${path}?page=${value}` : path)}
          page={page}
          totalPages={totalPages}
        />
      </section>
    </main>
  );
}
