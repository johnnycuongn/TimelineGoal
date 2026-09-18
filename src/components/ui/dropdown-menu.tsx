import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        className={cn(
          "z-50 min-w-48 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg",
          className,
        )}
        sideOffset={6}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      className={cn(
        "flex min-h-11 cursor-default select-none items-center rounded-xl px-3 text-sm outline-none data-[highlighted]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}
