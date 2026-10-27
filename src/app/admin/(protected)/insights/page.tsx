import { Copy, Eye, Info, MousePointerClick, Percent, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/components/ui/utils";
import { getInsights, type InsightsRange } from "@/features/analytics/server/insights";
import { readPageAdmin } from "@/features/auth/server/guards";
import { getDatabase } from "@/server/db/client";
import { formatPercent } from "@/shared/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "统计 · Prompt Gallery",
  robots: { index: false, follow: false },
};

const RANGES: InsightsRange[] = [7, 30];

function dayKeys(days: number, now: Date): string[] {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, index) =>
    new Date(end - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10),
  );
}

const number = (value: number) => value.toLocaleString("zh-CN");

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const admin = await readPageAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const range: InsightsRange = (await searchParams).range === "30" ? 30 : 7;
  const now = new Date();
  const insights = await getInsights(getDatabase(), range, now);
  const byDay = new Map(insights.daily.map((row) => [row.day, row]));
  const series = dayKeys(range, now).map((day) => ({
    day,
    detailViews: byDay.get(day)?.detailViews ?? 0,
    copies: byDay.get(day)?.copies ?? 0,
  }));
  const peak = Math.max(1, ...series.map((row) => Math.max(row.detailViews, row.copies)));
  const { totals } = insights;

  return (
    <section className="grid gap-8">
      <PageHeader
        actions={
          <nav aria-label="时间范围" className="flex rounded-lg border border-border-strong bg-surface p-1">
            {RANGES.map((value) => (
              <Link
                aria-current={value === range ? "page" : undefined}
                className={cn(
                  "min-h-8 rounded-md px-3 py-1.5 text-xs transition-colors",
                  value === range ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground",
                )}
                href={value === 7 ? "/admin/insights" : `/admin/insights?range=${value}`}
                key={value}
              >
                最近 {value} 天
              </Link>
            ))}
          </nav>
        }
        description="访客浏览、复制与搜索的粗略次数。"
        eyebrow="Insights"
        title="统计"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat icon={<MousePointerClick className="size-4" />} label="页面浏览" value={number(totals.pageViews)} />
        <Stat icon={<Eye className="size-4" />} label="详情浏览" value={number(totals.detailViews)} />
        <Stat icon={<Copy className="size-4" />} label="复制 Prompt" tone="accent" value={number(totals.copies)} />
        <Stat
          hint="复制 ÷ 详情浏览"
          icon={<Percent className="size-4" />}
          label="复制率"
          value={formatPercent(totals.copyRate)}
        />
        <Stat
          hint={`其中 ${number(totals.emptySearches)} 次无结果`}
          icon={<Search className="size-4" />}
          label="搜索"
          tone={totals.emptySearches > 0 ? "warning" : "default"}
          value={number(totals.searches)}
        />
      </div>

      <Card>
        <CardHeader
          action={
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-sm bg-foreground/40" />
                详情浏览
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-sm bg-accent" />
                复制
              </span>
            </div>
          }
          description="按 UTC 日期聚合"
          title="每日趋势"
        />
        <div className="px-5 pt-6 pb-4">
          <div
            aria-label={`最近 ${range} 天共 ${totals.detailViews} 次详情浏览、${totals.copies} 次复制`}
            className="flex h-48 items-end gap-1 border-b border-border-strong"
            role="img"
          >
            {series.map((row) => (
              <div
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-px"
                key={row.day}
                title={`${row.day}：浏览 ${row.detailViews}，复制 ${row.copies}`}
              >
                <span
                  className="w-full max-w-3 rounded-t-sm bg-foreground/25 transition-colors group-hover:bg-foreground/40"
                  style={{ height: `${(row.detailViews / peak) * 100}%` }}
                />
                <span
                  className="w-full max-w-3 rounded-t-sm bg-accent/80 shadow-[0_0_12px_-4px_var(--accent)] transition-colors group-hover:bg-accent"
                  style={{ height: `${(row.copies / peak) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="mt-2 flex justify-between font-mono text-[11px] text-muted">
            <span>{series[0]?.day.slice(5)}</span>
            <span>{series.at(-1)?.day.slice(5)}</span>
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="overflow-hidden">
          <CardHeader description="已发布内容，按复制次数排序" title="热门内容" />
          {insights.topPrompts.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">这段时间还没有浏览或复制记录。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-border">
                    <th className="w-10 px-5 py-2.5 font-normal">#</th>
                    <th className="px-2 py-2.5 font-normal">内容</th>
                    <th className="px-2 py-2.5 text-right font-normal">浏览</th>
                    <th className="px-2 py-2.5 text-right font-normal">复制</th>
                    <th className="px-5 py-2.5 text-right font-normal">复制率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {insights.topPrompts.map((item, index) => (
                    <tr className="hover:bg-surface-2/40" key={item.id}>
                      <td className="px-5 py-3 font-mono text-xs text-muted">{index + 1}</td>
                      <td className="max-w-0 px-2 py-3">
                        <Link className="block truncate hover:text-accent" href={`/admin/prompts/${item.id}/edit`}>
                          {item.title || "未命名"}
                        </Link>
                      </td>
                      <td className="px-2 py-3 text-right font-mono tabular-nums">{number(item.detailViews)}</td>
                      <td className="px-2 py-3 text-right font-mono text-accent tabular-nums">{number(item.copies)}</td>
                      <td className="px-5 py-3 text-right font-mono text-muted tabular-nums">
                        {formatPercent(item.detailViews > 0 ? item.copies / item.detailViews : null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader description="访客想找但库里还没有的内容" title="无结果搜索" />
          {insights.emptySearches.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">没有无结果的搜索。</p>
          ) : (
            <ul className="divide-y divide-border">
              {insights.emptySearches.map((entry) => (
                <li className="flex items-center justify-between gap-3 px-5 py-2.5" key={entry.query}>
                  <span className="min-w-0 truncate font-mono text-sm">{entry.query}</span>
                  <span className="shrink-0 font-mono text-xs text-muted tabular-nums">×{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="flex items-start gap-2 text-xs leading-5 text-muted">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        这些是粗略事件次数：不区分访客，同一人多次浏览会重复计数；超过频率限制、被拦截脚本或关闭 JavaScript 的访问不会被记录。适合看趋势和找内容缺口，不适合当精确流量。
      </p>
    </section>
  );
}
