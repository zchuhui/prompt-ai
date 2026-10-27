import type { Metadata } from "next";
import Link from "next/link";
import { listAdminPrompts } from "@/features/prompts/server/service";
import { parsePage, parsePageSize } from "@/shared/pagination";
import { getDatabase } from "@/server/db/client";
import { PromptBatchBar } from "./batch-bar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "内容 · Prompt Gallery",
  robots: { index: false, follow: false },
};

type Search = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function AdminPromptsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const status = one(params.status);
  const result = await listAdminPrompts(getDatabase(), {
    q: one(params.q) || undefined,
    status: status === "draft" || status === "published" ? status : undefined,
    page: parsePage(one(params.page) || undefined),
    pageSize: parsePageSize(one(params.pageSize) || undefined),
  });

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">内容</h1>
        <Link className="inline-flex min-h-11 items-center bg-accent px-4 text-sm text-background" href="/admin/prompts/new">
          新建草稿
        </Link>
      </div>
      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <input className="min-h-11 border border-border px-3" defaultValue={one(params.q)} name="q" placeholder="按标题搜索" />
        <select className="min-h-11 border border-border bg-background px-3" defaultValue={status} name="status">
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
        </select>
        <button className="min-h-11 border border-border px-4" type="submit">筛选</button>
      </form>
      <PromptBatchBar items={result.items} />
      <p className="mt-4 text-sm text-muted">共 {result.total} 条</p>
    </section>
  );
}
