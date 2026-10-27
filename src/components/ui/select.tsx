import { ChevronDown } from "lucide-react";
import { fieldClass } from "./input";
import { cn } from "./utils";

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select className={cn(fieldClass, "min-h-11 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
      />
    </span>
  );
}
