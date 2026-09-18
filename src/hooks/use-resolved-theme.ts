import { useTheme } from "next-themes";

export function useResolvedTheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "dark" : "light";
}
