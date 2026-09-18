import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/auth/auth-provider";
import { PupMoodProvider } from "@/components/pup/pup-mood-context";
import { router } from "@/routes";
import "@/styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element.");
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <PupMoodProvider>
          <RouterProvider router={router} />
        </PupMoodProvider>
      </AuthProvider>
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  </StrictMode>,
);
