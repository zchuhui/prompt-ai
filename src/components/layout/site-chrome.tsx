import { Menu } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { LogoMark } from "@/components/brand/logo-mark";
import { Sheet } from "@/components/ui/sheet";
import { HeaderSearch } from "./header-search";
import { SiteNav } from "./site-nav";

export function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <Link className="group inline-flex shrink-0 items-center gap-2.5" href={href}>
      <LogoMark className="size-8 text-accent" />
      <span className="text-xl font-semibold tracking-[0.12em] whitespace-nowrap">
        图种
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-4 px-4 md:px-6">
        <BrandMark />
        <div className="hidden md:block">
          <SiteNav />
        </div>
        <Suspense fallback={<div className="ml-auto hidden h-10 w-80 md:block" />}>
          <HeaderSearch className="ml-auto hidden w-full max-w-sm md:block" />
        </Suspense>
        <div className="ml-auto md:hidden">
          <Sheet
            title="导航"
            trigger={<Menu aria-hidden="true" className="size-5" />}
            triggerClassName="inline-flex size-11 items-center justify-center rounded-lg border border-border-strong text-muted"
            triggerLabel="打开菜单"
          >
            <Suspense>
              <HeaderSearch shortcut={false} />
            </Suspense>
            <div className="mt-4">
              <SiteNav vertical />
            </div>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80">
      <div className="mx-auto grid w-full max-w-[1600px] gap-8 px-4 py-10 md:grid-cols-[1.5fr_1fr_1fr] md:px-6">
        <div>
          <BrandMark />
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            种下一句，长出想象。浏览效果图，发现并复制提示词，在你的生成工具里探索。
          </p>
        </div>
        <div className="text-sm">
          <p className="font-mono text-[11px] tracking-[0.2em] text-muted uppercase">浏览</p>
          <ul className="mt-3 grid gap-2">
            <li><Link className="text-foreground/80 hover:text-accent" href="/">图片库</Link></li>
            <li><Link className="text-foreground/80 hover:text-accent" href="/collections">专题合集</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-mono text-[11px] tracking-[0.2em] text-muted uppercase">说明</p>
          <ul className="mt-3 grid gap-2">
            <li><Link className="text-foreground/80 hover:text-accent" href="/about">关于与来源说明</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <p className="mx-auto w-full max-w-[1600px] px-4 py-4 font-mono text-[11px] text-muted md:px-6">
          生成效果会因模型版本、参数和随机性而变化。
        </p>
      </div>
    </footer>
  );
}
