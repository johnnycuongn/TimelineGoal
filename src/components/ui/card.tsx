import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("island-shell p-5 sm:p-6", className)} data-slot="card" {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mb-4 space-y-1", className)} data-slot="card-header" {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("", className)} data-slot="card-content" {...props} />;
}
