import type { Metadata } from "next";
import Link from "next/link";
import { listPublicCollections } from "@/features/collections/server/service";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "专题合集 · Prompt Gallery",
};

export default async function CollectionsPage() {
  const collections = await listPublicCollections(getDatabase());
  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">专题合集</h1>
      {collections.length === 0 ? (
        <p className="mt-6 text-muted">还没有公开合集。</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {collections.map((collection) => (
            <li className="border border-border p-5" key={collection.id}>
              <Link href={`/collections/${collection.slug}`}>
                <h2 className="text-xl font-medium">{collection.title}</h2>
                {collection.description ? (
                  <p className="mt-2 text-sm leading-6 text-muted">{collection.description}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
