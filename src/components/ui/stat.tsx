import Link from "next/link";
import { cn } from "./utils";

export function Stat({
  label,
  value,
  hint,
  href,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  tone?: "default" | "accent" | "warning" | "danger";
  icon?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{label}</span>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
      </div>
      <p
        className={cn(
          "mt-3 font-mono text-3xl font-semibold tracking-tight tabular-nums",
          tone === "accent" && "text-accent",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </>
  );
  const className =
    "block rounded-xl border border-border bg-surface/80 p-5 backdrop-blur-sm transition-colors";
  return href ? (
    <Link className={cn(className, "hover:border-accent/40 hover:bg-surface-2/60")} href={href}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
