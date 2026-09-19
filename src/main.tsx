import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/auth/auth-provider";
import { PupMoodProvider } from "@/components/pup/pup-mood-context";
import { watchKeyboardInset } from "@/lib/keyboard-inset";
import { startKeyboardProbe } from "@/lib/keyboard-probe";
import { router } from "@/routes";
import "@/styles.css";

// The bottom sheet reads this to sit on top of the software keyboard instead of behind
// it. Set on the root for the whole session: only the sheet consumes it.
watchKeyboardInset(window, (px) => {
  document.documentElement.style.setProperty("--keyboard-inset", `${px}px`);
});

// TEMPORARY: ?kbdebug=1 draws the live viewport numbers over the app. Off otherwise.
if (new URLSearchParams(window.location.search).has("kbdebug")) {
  startKeyboardProbe();
}

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
