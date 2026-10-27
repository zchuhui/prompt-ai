import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { listAdminTaxonomies } from "@/features/taxonomies/server/service";
import { getDatabase } from "@/server/db/client";
import { UploadWorkspace } from "./upload-workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "上传 · 图种",
  robots: { index: false, follow: false },
};

export default async function UploadsPage() {
  const taxonomies = await listAdminTaxonomies(getDatabase());
  return (
    <section className="grid gap-6">
      <PageHeader
        description="图片上传后会在后台处理，完成后自动生成草稿。处理期间可以离开页面。"
        eyebrow="Upload"
        title="批量上传"
      />
      <UploadWorkspace
        categories={taxonomies.categories.map(({ id, name }) => ({ id, name }))}
        models={taxonomies.models.filter((model) => model.active).map(({ id, name }) => ({ id, name }))}
        tags={taxonomies.tags.map(({ id, name }) => ({ id, name }))}
      />
    </section>
  );
}
