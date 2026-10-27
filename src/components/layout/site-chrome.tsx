import { Images } from "lucide-react";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight" href="/">
          <Images aria-hidden="true" size={18} />
          Prompt Gallery
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="min-h-11 inline-flex items-center" href="/">
            图片库
          </Link>
          <Link className="min-h-11 inline-flex items-center" href="/collections">
            专题合集
          </Link>
          <Link className="min-h-11 inline-flex items-center" href="/about">
            关于
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-[1600px] justify-between gap-4 px-6 py-6 text-sm text-muted">
        <p>生成效果会因模型版本、参数和随机性而变化。</p>
        <Link href="/about">来源说明</Link>
      </div>
    </footer>
  );
}
