import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录 · Prompt Gallery",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm text-accent">Prompt Gallery</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">管理员登录</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        仅供内容管理。访客浏览公开画廊不需要登录。
      </p>
      <LoginForm />
    </main>
  );
}
