import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "flex min-h-11 w-full appearance-none rounded-2xl border border-input bg-card px-4 pr-10 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          className,
        )}
        data-slot="native-select"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
