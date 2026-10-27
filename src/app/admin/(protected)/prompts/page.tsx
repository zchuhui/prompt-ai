import { Plus, Search, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/components/ui/utils";
import { listAdminPrompts } from "@/features/prompts/server/service";
import { listAdminTaxonomies } from "@/features/taxonomies/server/service";
import { parsePage } from "@/shared/pagination";
import { getDatabase } from "@/server/db/client";
import { PromptTable } from "./prompt-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "内容 · 图种",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;

type Search = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const statusTabs = [
  { value: "", label: "全部" },
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
] as const;

export default async function AdminPromptsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const filters = {
    q: one(params.q).trim(),
    status: one(params.status),
    categoryId: one(params.categoryId),
    modelId: one(params.modelId),
  };
  const page = parsePage(one(params.page) || undefined);
  const db = getDatabase();
  const [result, taxonomies] = await Promise.all([
    listAdminPrompts(db, {
      q: filters.q || undefined,
      status: filters.status === "draft" || filters.status === "published" ? filters.status : undefined,
      categoryId: filters.categoryId || undefined,
      modelId: filters.modelId || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    listAdminTaxonomies(db),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const hrefWith = (next: Partial<typeof filters> & { page?: number }) => {
    const merged = { ...filters, ...next };
    const query = new URLSearchParams();
    for (const key of ["q", "status", "categoryId", "modelId"] as const) {
      if (merged[key]) {
        query.set(key, merged[key]);
      }
    }
    if (next.page && next.page > 1) {
      query.set("page", String(next.page));
    }
    const text = query.toString();
    return text ? `/admin/prompts?${text}` : "/admin/prompts";
  };
  const filtered = Boolean(filters.q || filters.categoryId || filters.modelId);

  return (
    <section className="grid gap-6">
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
        description={`共 ${result.total} 条`}
        eyebrow="Content"
        title="内容"
      />
      <div className="grid gap-3">
        <nav aria-label="状态" className="flex gap-1 border-b border-border">
          {statusTabs.map((tab) => {
            const active = filters.status === tab.value;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-10 items-center border-b-2 px-3 text-sm transition-colors",
                  active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground",
                )}
                href={hrefWith({ status: tab.value, page: 1 })}
                key={tab.value}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <form action="/admin/prompts" className="flex flex-wrap items-center gap-2" method="get">
          {filters.status ? <input name="status" type="hidden" value={filters.status} /> : null}
          <div className="relative min-w-[200px] flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted"
            />
            <input
              aria-label="按标题搜索"
              className={cn(fieldClass, "min-h-10 pl-9")}
              defaultValue={filters.q}
              name="q"
              placeholder="按标题搜索"
              type="search"
            />
          </div>
          <select
            aria-label="分类"
            className={cn(fieldClass, "min-h-10 w-auto pr-8")}
            defaultValue={filters.categoryId}
            name="categoryId"
          >
            <option value="">全部分类</option>
            {taxonomies.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            aria-label="模型"
            className={cn(fieldClass, "min-h-10 w-auto pr-8")}
            defaultValue={filters.modelId}
            name="modelId"
          >
            <option value="">全部模型</option>
            {taxonomies.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <Button className="min-h-10" type="submit" variant="outline">
            筛选
          </Button>
          {filtered ? (
            <Link className="px-2 text-sm text-muted hover:text-foreground" href={hrefWith({ q: "", categoryId: "", modelId: "" })}>
              清除
            </Link>
          ) : null}
        </form>
      </div>
      {result.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface/40 px-6 py-14 text-center">
          <p className="font-medium">{filtered || filters.status ? "没有符合条件的内容" : "还没有内容"}</p>
          <p className="mt-2 text-sm text-muted">
            {filtered || filters.status ? "调整筛选条件再试试。" : "上传几张图片，系统会为每张图生成一个草稿。"}
          </p>
        </div>
      ) : (
        <PromptTable items={result.items} />
      )}
      <Pagination hrefFor={(value) => hrefWith({ page: value })} page={page} totalPages={totalPages} />
    </section>
  );
}
