import { ChevronRight, Library } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewCollectionForm } from "@/features/collections/components/new-collection-form";
import { listAdminCollections } from "@/features/collections/server/service";
import { StatusBadge } from "@/features/prompts/components/status-badge";
import { getDatabase } from "@/server/db/client";
import { formatDateTime } from "@/shared/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "合集 · 图种",
  robots: { index: false, follow: false },
};

export default async function AdminCollectionsPage() {
  const collections = await listAdminCollections(getDatabase());
  return (
    <section className="grid gap-6">
      <PageHeader
        actions={<NewCollectionForm />}
        description={`共 ${collections.length} 个合集`}
        eyebrow="Collections"
        title="合集"
      />
      {collections.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Library aria-hidden="true" className="size-6 text-muted" />
          <p className="text-sm text-muted">还没有合集。输入标题新建一个，再把内容加进去。</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {collections.map((collection) => (
              <li key={collection.id}>
                <Link
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/50"
                  href={`/admin/collections/${collection.id}/edit`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium group-hover:text-accent">{collection.title}</span>
                    <span className="mt-1 block truncate font-mono text-xs text-muted">
                      /collections/{collection.slug}
                    </span>
                  </span>
                  <span className="hidden w-20 text-right font-mono text-xs text-muted sm:block">
                    {collection.memberCount} 条
                  </span>
                  <StatusBadge status={collection.status} />
                  <span className="hidden w-36 text-right font-mono text-xs text-muted md:block">
                    {formatDateTime(collection.updatedAt)}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 text-muted group-hover:text-accent" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
