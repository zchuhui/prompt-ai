import { cn } from "./utils";

export const fieldClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-muted transition-colors hover:border-[#3a414d] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 aria-invalid:border-danger";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldClass, "min-h-11", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium text-foreground/90">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
