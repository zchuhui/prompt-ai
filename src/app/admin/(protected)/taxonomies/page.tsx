import type { Metadata } from "next";
import { TaxonomyManager } from "@/features/taxonomies/components/taxonomy-manager";
import { listAdminTaxonomies } from "@/features/taxonomies/server/service";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "分类 · Prompt Gallery",
  robots: { index: false, follow: false },
};

export default async function TaxonomiesPage() {
  const data = await listAdminTaxonomies(getDatabase());
  return (
    <section>
      <h1 className="mb-6 text-3xl font-semibold">分类、标签与模型</h1>
      <TaxonomyManager categories={data.categories} models={data.models} tags={data.tags} />
    </section>
  );
}
