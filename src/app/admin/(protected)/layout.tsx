import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSessionProvider } from "@/features/auth/admin-client";
import { readPageAdmin } from "@/features/auth/server/guards";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await readPageAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <AdminSessionProvider csrfToken={admin.csrfToken}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-sm text-accent">管理后台</p>
            <p className="mt-1 text-sm text-muted">{admin.username}</p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm">
            <Link className="inline-flex min-h-11 items-center" href="/admin/prompts">内容</Link>
            <Link className="inline-flex min-h-11 items-center" href="/admin/uploads">上传</Link>
            <Link className="inline-flex min-h-11 items-center" href="/admin/taxonomies">分类</Link>
            <Link className="inline-flex min-h-11 items-center" href="/admin/collections">合集</Link>
          </nav>
          <LogoutButton csrfToken={admin.csrfToken} />
        </header>
        <div className="flex-1 py-8">{children}</div>
      </div>
    </AdminSessionProvider>
  );
}
