import { fieldClass } from "./input";
import { cn } from "./utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "min-h-24 py-2.5 leading-6", className)} {...props} />;
}
