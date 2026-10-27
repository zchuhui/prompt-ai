import { ExternalLink, Menu } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/layout/site-chrome";
import { Sheet } from "@/components/ui/sheet";
import { AdminSessionProvider } from "@/features/auth/admin-client";
import { readPageAdmin } from "@/features/auth/server/guards";
import { AdminNav } from "./admin-nav";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function SidebarFooter({ username, csrfToken }: { username: string; csrfToken: string }) {
  return (
    <div className="grid gap-3 border-t border-border pt-4">
      <Link
        className="inline-flex min-h-9 items-center gap-2 px-3 text-xs text-muted hover:text-foreground"
        href="/"
        target="_blank"
      >
        <ExternalLink aria-hidden="true" className="size-3.5" />
        查看前台
      </Link>
      <div className="flex items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-xs text-accent uppercase">
            {username.slice(0, 1)}
          </span>
          <span className="truncate text-sm">{username}</span>
        </div>
        <LogoutButton csrfToken={csrfToken} />
      </div>
    </div>
  );
}

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await readPageAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <AdminSessionProvider csrfToken={admin.csrfToken}>
      <div className="flex min-h-dvh w-full flex-1">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface/50 px-3 py-5 backdrop-blur lg:flex">
          <div className="flex items-center gap-2 px-3">
            <BrandMark href="/admin" />
          </div>
          <p className="px-3 font-mono text-[10px] tracking-[0.25em] text-muted uppercase">Console</p>
          <div className="-mt-3 flex-1 overflow-y-auto pl-3">
            <AdminNav />
          </div>
          <SidebarFooter csrfToken={admin.csrfToken} username={admin.username} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:hidden">
            <BrandMark href="/admin" />
            <Sheet
              side="left"
              title="后台导航"
              trigger={<Menu aria-hidden="true" className="size-5" />}
              triggerClassName="inline-flex size-11 items-center justify-center rounded-lg border border-border-strong text-muted"
              triggerLabel="打开后台导航"
            >
              <div className="flex h-full flex-col gap-6 pl-3">
                <AdminNav />
                <div className="-ml-3 mt-auto">
                  <SidebarFooter csrfToken={admin.csrfToken} username={admin.username} />
                </div>
              </div>
            </Sheet>
          </header>
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </AdminSessionProvider>
  );
}
