import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: generic primitive; callers pass htmlFor and children
    <label className={cn("block font-semibold text-sm", className)} data-slot="label" {...props} />
  );
}
