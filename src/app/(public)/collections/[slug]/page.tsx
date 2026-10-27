import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicCollection } from "@/features/collections/server/service";
import { parsePage, parsePageSize } from "@/shared/pagination";
import { getDatabase } from "@/server/db/client";
import { getEnv } from "@/server/env";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Context): Promise<Metadata> {
  const collection = await getPublicCollection(getDatabase(), (await params).slug, 1, 24);
  if (!collection) {
    return { title: "未找到 · Prompt Gallery" };
  }
  const origin = new URL(getEnv().APP_URL).origin;
  return {
    title: `${collection.title} · Prompt Gallery`,
    description: collection.description ?? undefined,
    alternates: { canonical: `${origin}/collections/${collection.slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }: Context) {
  const query = await searchParams;
  const pageValue = Array.isArray(query.page) ? query.page[0] : query.page;
  const collection = await getPublicCollection(
    getDatabase(),
    (await params).slug,
    parsePage(pageValue),
    parsePageSize(undefined),
  );
  if (!collection) {
    notFound();
  }
  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">{collection.title}</h1>
      {collection.description ? <p className="mt-3 max-w-2xl leading-7 text-muted">{collection.description}</p> : null}
      <ol className="mt-8 flex flex-col gap-3">
        {collection.members.map((member) => (
          <li key={member.id}>
            <Link href={`/prompts/${member.slug}`}>{member.title}</Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
