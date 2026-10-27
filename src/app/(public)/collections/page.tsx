import { ArrowUpRight, Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";
import { listPublicCollections } from "@/features/collections/server/service";
import { mediaSrc } from "@/features/prompts/components/gallery-card";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "专题合集 · 图种",
  description: "按主题整理的图片生成提示词合集。",
};

type Cover = { id: string; width: number; height: number };

const collageLayout: Record<number, string[]> = {
  1: ["col-span-3 row-span-2"],
  2: ["col-span-2 row-span-2", "col-span-1 row-span-2"],
  3: ["col-span-2 row-span-2", "col-span-1 row-span-1", "col-span-1 row-span-1"],
};

function Collage({ covers }: { covers: Cover[] }) {
  if (covers.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center bg-surface-2 text-muted">
        <Layers aria-hidden="true" className="size-6" />
      </div>
    );
  }
  const layout = collageLayout[covers.length] ?? collageLayout[3];
  return (
    <div className="grid aspect-[16/10] grid-cols-3 grid-rows-2 gap-px bg-border">
      {covers.slice(0, 3).map((cover, index) => (
        <div className={cn("relative overflow-hidden bg-surface-2", layout?.[index])} key={cover.id}>
          <img
            alt=""
            className="absolute inset-0 size-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.04]"
            decoding="async"
            height={cover.height}
            loading={index === 0 ? "eager" : "lazy"}
            src={mediaSrc(cover.id, "card")}
            width={cover.width}
          />
        </div>
      ))}
    </div>
  );
}

export default async function CollectionsPage() {
  const collections = await listPublicCollections(getDatabase());
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-10 pb-16 md:px-6 md:pt-14">
      <header className="max-w-2xl">
        <Eyebrow>Collections</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">专题合集</h1>
        <p className="mt-3 leading-7 text-muted">按主题整理的一组提示词，适合从一个方向集中找灵感。</p>
      </header>
      {collections.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border-strong bg-surface/40 px-6 py-12 text-center">
          <p className="text-lg font-medium">还没有公开合集</p>
          <p className="mt-2 text-sm text-muted">
            先去
            <Link className="mx-1 text-accent hover:underline" href="/">
              图片库
            </Link>
            看看吧。
          </p>
        </div>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link
                className="glow-card group flex h-full flex-col overflow-hidden rounded-xl"
                href={`/collections/${collection.slug}`}
              >
                <Collage covers={collection.covers} />
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-medium">{collection.title}</h2>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-muted transition-colors group-hover:text-accent"
                    />
                  </div>
                  {collection.description ? (
                    <p className="line-clamp-2 text-sm leading-6 text-muted">{collection.description}</p>
                  ) : null}
                  <p className="mt-auto pt-2 font-mono text-[11px] text-muted">
                    <span className="text-accent">{collection.memberCount}</span> 条提示词
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
