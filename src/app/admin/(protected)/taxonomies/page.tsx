import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { TaxonomyManager } from "@/features/taxonomies/components/taxonomy-manager";
import { listAdminTaxonomies } from "@/features/taxonomies/server/service";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "分类 · 图种",
  robots: { index: false, follow: false },
};

export default async function TaxonomiesPage() {
  const data = await listAdminTaxonomies(getDatabase());
  return (
    <section className="grid gap-6">
      <PageHeader
        description="管理前台筛选用的分类、标签和模型。"
        eyebrow="Taxonomy"
        title="分类、标签与模型"
      />
      <TaxonomyManager categories={data.categories} models={data.models} tags={data.tags} />
    </section>
  );
}
