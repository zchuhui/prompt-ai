import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/components/ui/utils";
import { galleryHref, toggleTag, withParams, type GalleryParams } from "../gallery-query";

type Option = { id: string; name: string; slug: string };

export type GalleryFilterOptions = {
  categories: Option[];
  models: Option[];
  tags: Option[];
};

function Chip({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      aria-current={selected ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-[13px] transition-colors",
        selected
          ? "border-accent/60 bg-accent/10 text-accent shadow-[0_0_16px_-6px_var(--accent)]"
          : "border-border-strong text-muted hover:border-[#3a414d] hover:text-foreground",
      )}
      href={href}
      scroll={false}
    >
      {children}
    </Link>
  );
}

function ChipRow({
  label,
  wrap,
  children,
}: {
  label: string;
  wrap: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex gap-3", wrap ? "flex-col" : "items-center")}>
      <span className="w-10 shrink-0 font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
        {label}
      </span>
      <div
        className={cn(
          "flex gap-2",
          wrap ? "flex-wrap" : "scrollbar-none -my-1 overflow-x-auto py-1 [mask-image:linear-gradient(to_right,black_92%,transparent)] pr-8",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function FilterRows({
  params,
  options,
  wrap,
}: {
  params: GalleryParams;
  options: GalleryFilterOptions;
  wrap: boolean;
}) {
  return (
    <div className="grid gap-3">
      <ChipRow label="分类" wrap={wrap}>
        <Chip href={galleryHref(withParams(params, { category: "" }))} selected={!params.category}>
          全部
        </Chip>
        {options.categories.map((item) => (
          <Chip
            href={galleryHref(
              withParams(params, { category: params.category === item.slug ? "" : item.slug }),
            )}
            key={item.id}
            selected={params.category === item.slug}
          >
            {item.name}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow label="模型" wrap={wrap}>
        <Chip href={galleryHref(withParams(params, { model: "" }))} selected={!params.model}>
          全部
        </Chip>
        {options.models.map((item) => (
          <Chip
            href={galleryHref(withParams(params, { model: params.model === item.slug ? "" : item.slug }))}
            key={item.id}
            selected={params.model === item.slug}
          >
            <span className="font-mono text-[12px]">{item.name}</span>
          </Chip>
        ))}
      </ChipRow>
      {options.tags.length > 0 ? (
        <ChipRow label="标签" wrap={wrap}>
          {options.tags.map((item) => (
            <Chip
              href={galleryHref(toggleTag(params, item.slug))}
              key={item.id}
              selected={params.tags.includes(item.slug)}
            >
              #{item.name}
            </Chip>
          ))}
        </ChipRow>
      ) : null}
    </div>
  );
}

function activeFilters(params: GalleryParams, options: GalleryFilterOptions) {
  const active: Array<{ key: string; label: string; href: string }> = [];
  if (params.q) {
    active.push({ key: "q", label: `“${params.q}”`, href: galleryHref(withParams(params, { q: "" })) });
  }
  const category = options.categories.find((item) => item.slug === params.category);
  if (params.category) {
    active.push({
      key: "category",
      label: category?.name ?? params.category,
      href: galleryHref(withParams(params, { category: "" })),
    });
  }
  const model = options.models.find((item) => item.slug === params.model);
  if (params.model) {
    active.push({
      key: "model",
      label: model?.name ?? params.model,
      href: galleryHref(withParams(params, { model: "" })),
    });
  }
  for (const slug of params.tags) {
    const tag = options.tags.find((item) => item.slug === slug);
    active.push({
      key: `tag:${slug}`,
      label: `#${tag?.name ?? slug}`,
      href: galleryHref(toggleTag(params, slug)),
    });
  }
  return active;
}

export function ActiveFilters({
  params,
  options,
  className,
}: {
  params: GalleryParams;
  options: GalleryFilterOptions;
  className?: string;
}) {
  const active = activeFilters(params, options);
  if (active.length === 0) {
    return null;
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {active.map((item) => (
        <Link
          aria-label={`移除条件 ${item.label}`}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2.5 text-xs text-accent hover:bg-accent/20"
          href={item.href}
          key={item.key}
          scroll={false}
        >
          {item.label}
          <X aria-hidden="true" className="size-3.5" />
        </Link>
      ))}
      <Link className="inline-flex min-h-8 items-center px-2 text-xs text-muted hover:text-foreground" href="/">
        清空筛选
      </Link>
    </div>
  );
}

export function FilterBar({
  params,
  options,
}: {
  params: GalleryParams;
  options: GalleryFilterOptions;
}) {
  const activeCount =
    (params.category ? 1 : 0) + (params.model ? 1 : 0) + params.tags.length;
  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <form action="/" className="relative flex flex-1 gap-2" method="get" role="search">
          {params.category ? <input name="category" type="hidden" value={params.category} /> : null}
          {params.model ? <input name="model" type="hidden" value={params.model} /> : null}
          {params.tags.length > 0 ? (
            <input name="tags" type="hidden" value={params.tags.join(",")} />
          ) : null}
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted"
          />
          <input
            aria-label="搜索标题、简介、提示词或标签"
            className="min-h-12 w-full rounded-xl border border-border-strong bg-surface/80 pr-3 pl-10 text-[15px] text-foreground backdrop-blur placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            defaultValue={params.q}
            key={params.q}
            maxLength={100}
            name="q"
            placeholder="搜索标题、简介、提示词或标签"
            type="search"
          />
          <Button className="min-h-12 rounded-xl px-5" type="submit">
            搜索
          </Button>
        </form>
        <div className="md:hidden">
          <Sheet
            side="bottom"
            title="筛选"
            trigger={
              <>
                <SlidersHorizontal aria-hidden="true" className="size-4" />
                {activeCount > 0 ? (
                  <span className="font-mono text-xs text-accent">{activeCount}</span>
                ) : null}
              </>
            }
            triggerClassName="inline-flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-xl border border-border-strong bg-surface/80 px-3 text-muted"
            triggerLabel="打开筛选"
          >
            <FilterRows options={options} params={params} wrap />
          </Sheet>
        </div>
      </div>
      <div className="hidden rounded-xl border border-border bg-surface/50 p-4 backdrop-blur md:block">
        <FilterRows options={options} params={params} wrap={false} />
      </div>
    </div>
  );
}
