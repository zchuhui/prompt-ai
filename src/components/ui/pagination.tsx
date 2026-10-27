import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "./utils";

function pagesAround(page: number, totalPages: number): Array<number | "gap"> {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  for (const value of pages) {
    const previous = result.at(-1);
    if (typeof previous === "number" && value - previous > 1) {
      result.push("gap");
    }
    result.push(value);
  }
  return result;
}

const itemClass =
  "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border px-2 font-mono text-xs transition-colors";

export function Pagination({
  page,
  totalPages,
  hrefFor,
  className,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) {
    return null;
  }
  return (
    <nav aria-label="分页" className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}>
      {page > 1 ? (
        <Link
          aria-label="上一页"
          className={cn(itemClass, "border-border text-muted hover:border-accent/50 hover:text-accent")}
          href={hrefFor(page - 1)}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
      {pagesAround(page, totalPages).map((value, index) =>
        value === "gap" ? (
          <span aria-hidden="true" className="px-1 font-mono text-xs text-muted" key={`gap-${index}`}>
            …
          </span>
        ) : (
          <Link
            aria-current={value === page ? "page" : undefined}
            className={cn(
              itemClass,
              value === page
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border text-muted hover:border-accent/50 hover:text-accent",
            )}
            href={hrefFor(value)}
            key={value}
          >
            {value}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link
          aria-label="下一页"
          className={cn(itemClass, "border-border text-muted hover:border-accent/50 hover:text-accent")}
          href={hrefFor(page + 1)}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
