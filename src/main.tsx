import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { router } from "@/routes";
import "@/styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element.");
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  </StrictMode>,
);
