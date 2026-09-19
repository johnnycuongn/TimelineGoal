import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 font-heading font-semibold text-base transition-[transform,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground active:scale-[0.96]",
        // White on the light-theme pink is 3.52:1, so the ink is the dark one in each
        // theme: foreground on #ec4899 is 4.69:1, secondary-foreground on #f9a8d4 is 9:1.
        secondary:
          "bg-secondary text-foreground active:scale-[0.96] dark:text-secondary-foreground",
        outline: "border border-border bg-card text-foreground active:scale-[0.96]",
        ghost: "text-foreground hover:bg-muted active:scale-[0.96]",
      },
      size: {
        default: "min-h-11 px-5",
        sm: "min-h-11 px-4 text-sm",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      data-slot="button"
      {...props}
    />
  );
}
