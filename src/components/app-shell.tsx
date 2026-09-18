import { Heart, Home, Mountain, PawPrint } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import ThemeToggle from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export const NAV = [
  { to: "/den", label: "Den", icon: Home },
  { to: "/goals", label: "Timeline", icon: Mountain },
  { to: "/us", label: "Us", icon: Heart },
] as const;

function navClass({ isActive }: { isActive: boolean }): string {
  return cn("nav-link font-semibold text-sm", isActive && "is-active");
}

function tabClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold",
    isActive ? "text-primary" : "text-muted-foreground",
  );
}

export default function AppShell({
  showNav = true,
  right,
}: {
  showNav?: boolean;
  right?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top sticky top-0 z-40 border-border border-b bg-background/90 px-4 backdrop-blur-lg">
        <nav className="page-wrap flex items-center gap-3 py-2">
          <NavLink
            className="inline-flex min-h-11 items-center gap-2 font-heading text-foreground text-xl no-underline"
            to="/"
          >
            <PawPrint aria-hidden="true" className="size-5 text-primary" />
            CoupleGoal
          </NavLink>
          {showNav ? (
            <div className="ml-4 hidden items-center gap-4 md:flex">
              {NAV.map((item) => (
                <NavLink className={navClass} key={item.to} to={item.to}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            {right}
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <main className={cn("flex-1 px-4", showNav && "with-tab-bar")}>
        <Outlet />
      </main>
      {showNav ? (
        <nav
          aria-label="Main"
          className="tab-bar fixed inset-x-0 bottom-0 z-40 flex items-start gap-1 border-border border-t bg-background/95 px-2 pt-1 backdrop-blur-lg md:hidden"
        >
          {NAV.map((item) => (
            <NavLink className={tabClass} key={item.to} to={item.to}>
              <item.icon aria-hidden="true" className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
