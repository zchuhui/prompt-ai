import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionEditor } from "@/features/collections/components/collection-editor";
import { getAdminCollection } from "@/features/collections/server/service";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "编辑合集 · Prompt Gallery",
  robots: { index: false, follow: false },
};

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const collection = await getAdminCollection(getDatabase(), (await params).id).catch(() => null);
  if (!collection) {
    notFound();
  }
  return <CollectionEditor initial={collection} key={collection.id} />;
}
