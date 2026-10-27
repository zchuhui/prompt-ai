import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/layout/site-chrome";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录 · Prompt Gallery",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="relative flex w-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-1/2 -z-10 size-[28rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-2xl backdrop-blur sm:p-8">
          <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase">Console</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">管理员登录</h1>
          <p className="mt-2 text-sm leading-6 text-muted">仅供内容管理。访客浏览公开画廊不需要登录。</p>
          <LoginForm />
        </div>
        <Link
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-sm text-muted hover:text-foreground"
          href="/"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          返回图片库
        </Link>
      </div>
    </main>
  );
}
