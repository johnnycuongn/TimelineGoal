import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";

export default function ThemeToggle() {
  const { setTheme } = useTheme();
  const theme = useResolvedTheme();
  const toggle = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [setTheme, theme],
  );
  return (
    <Button
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      size="icon"
      type="button"
      variant="ghost"
    >
      {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}
