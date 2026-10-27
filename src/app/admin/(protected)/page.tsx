import {
  ArrowRight,
  CircleAlert,
  FileText,
  Library,
  LoaderCircle,
  Plus,
  Send,
  Upload,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { getInsights } from "@/features/analytics/server/insights";
import { readPageAdmin } from "@/features/auth/server/guards";
import { AdminThumb } from "@/features/prompts/components/admin-thumb";
import { StatusBadge } from "@/features/prompts/components/status-badge";
import { getAdminOverview } from "@/features/prompts/server/stats";
import { getDatabase } from "@/server/db/client";
import { formatDateTime, formatPercent } from "@/shared/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "概览 · Prompt Gallery",
  robots: { index: false, follow: false },
};

export default async function AdminHomePage() {
  const admin = await readPageAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const db = getDatabase();
  const [overview, week] = await Promise.all([getAdminOverview(db), getInsights(db, 7)]);

  return (
    <section className="grid gap-8">
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/uploads">
                <Upload aria-hidden="true" className="size-4" />
                批量上传
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/prompts/new">
                <Plus aria-hidden="true" className="size-4" />
                新建草稿
              </Link>
            </Button>
          </>
        }
        description={`你好，${admin.username}。这里是内容和上传的当前状态。`}
        eyebrow="Overview"
        title="概览"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          href="/admin/prompts?status=published"
          icon={<Send className="size-4" />}
          label="已发布"
          tone="accent"
          value={overview.published}
        />
        <Stat
          href="/admin/prompts?status=draft"
          icon={<FileText className="size-4" />}
          label="草稿"
          value={overview.drafts}
        />
        <Stat
          href="/admin/collections"
          icon={<Library className="size-4" />}
          label="合集"
          value={overview.collections}
        />
        <Stat
          hint={overview.pendingUploads > 0 ? "后台 worker 正在处理" : "没有排队的图片"}
          icon={<LoaderCircle className="size-4" />}
          label="处理中的上传"
          tone={overview.pendingUploads > 0 ? "warning" : "default"}
          value={overview.pendingUploads}
        />
        <Stat
          hint={overview.failedUploads > 0 ? "在内容编辑页重试或移除" : "一切正常"}
          icon={<CircleAlert className="size-4" />}
          label="失败的上传"
          tone={overview.failedUploads > 0 ? "danger" : "default"}
          value={overview.failedUploads}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            action={
              <Link className="inline-flex items-center gap-1 text-xs text-accent hover:underline" href="/admin/prompts">
                全部内容
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            }
            title="最近编辑"
          />
          {overview.recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">还没有内容，从“新建草稿”或“批量上传”开始。</p>
          ) : (
            <ul className="divide-y divide-border">
              {overview.recent.map((item) => (
                <li key={item.id}>
                  <Link
                    className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-2/50"
                    href={`/admin/prompts/${item.id}/edit`}
                  >
                    <AdminThumb assetId={item.coverId} className="size-11" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium group-hover:text-accent">
                        {item.title || "未命名草稿"}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-muted">{formatDateTime(item.updatedAt)}</span>
                    </span>
                    <StatusBadge status={item.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            action={
              <Link className="inline-flex items-center gap-1 text-xs text-accent hover:underline" href="/admin/insights">
                查看统计
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            }
            description="最近 7 天，粗略事件次数"
            title="访客反馈"
          />
          <dl className="grid grid-cols-3 divide-x divide-border">
            {[
              ["详情浏览", week.totals.detailViews.toLocaleString("zh-CN")],
              ["复制", week.totals.copies.toLocaleString("zh-CN")],
              ["复制率", formatPercent(week.totals.copyRate)],
            ].map(([label, value]) => (
              <div className="px-5 py-5" key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {week.emptySearches.length > 0 ? (
            <div className="border-t border-border px-5 py-4">
              <p className="text-xs text-muted">访客搜了但没找到</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {week.emptySearches.slice(0, 6).map((entry) => (
                  <span
                    className="rounded-full border border-border-strong px-2.5 py-1 font-mono text-xs"
                    key={entry.query}
                  >
                    {entry.query} <span className="text-muted">×{entry.count}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </section>
  );
}
