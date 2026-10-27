"use client";

import {
  ChartColumn,
  FileText,
  FolderTree,
  LayoutDashboard,
  Library,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/utils";

const items = [
  { href: "/admin", label: "概览", icon: LayoutDashboard, exact: true },
  { href: "/admin/prompts", label: "内容", icon: FileText },
  { href: "/admin/uploads", label: "上传", icon: Upload },
  { href: "/admin/taxonomies", label: "分类", icon: FolderTree },
  { href: "/admin/collections", label: "合集", icon: Library },
  { href: "/admin/insights", label: "统计", icon: ChartColumn },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="后台导航" className="grid gap-1">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
              active
                ? "bg-accent/10 text-accent before:absolute before:inset-y-2 before:-left-3 before:w-0.5 before:rounded-full before:bg-accent"
                : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
