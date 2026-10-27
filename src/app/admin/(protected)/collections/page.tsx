import type { Metadata } from "next";
import { CollectionManager } from "@/features/collections/components/collection-manager";
import { listAdminCollections } from "@/features/collections/server/service";
import { listAdminPrompts } from "@/features/prompts/server/service";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "合集 · Prompt Gallery",
  robots: { index: false, follow: false },
};

export default async function AdminCollectionsPage() {
  const db = getDatabase();
  const [collections, prompts] = await Promise.all([
    listAdminCollections(db),
    listAdminPrompts(db, { page: 1, pageSize: 48 }),
  ]);
  return (
    <section>
      <h1 className="mb-6 text-3xl font-semibold">合集</h1>
      <CollectionManager
        collections={collections.map((collection) => ({
          ...collection,
          description: collection.description,
        }))}
        prompts={prompts.items.map((item) => ({ id: item.id, title: item.title }))}
      />
    </section>
  );
}
