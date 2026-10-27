"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/utils";

const links = [
  { href: "/", label: "图片库" },
  { href: "/collections", label: "专题合集" },
  { href: "/about", label: "关于" },
];

export function SiteNav({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="主导航" className={cn("flex text-sm", vertical ? "flex-col gap-1" : "items-center gap-1")}>
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/" || pathname.startsWith("/prompts")
            : pathname.startsWith(link.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg px-3 transition-colors",
              active ? "text-foreground" : "text-muted hover:text-foreground",
              active && !vertical && "bg-surface-2",
              vertical && active && "bg-surface-2 text-accent",
            )}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
