import { useEffect } from "react";
import { PUP_URL } from "@/components/pup/pup-url";

/**
 * Warms the pup model on the routes that actually render it. The <link rel="preload">
 * used to sit in index.html, where /login and /pair paid for it too — 642 KB competing
 * with the JS bundle on the first screen a new user sees. Appended once per document;
 * the browser's cache does the rest on later navigations.
 */
export function usePreloadPup(): void {
  useEffect(() => {
    const selector = `link[rel="preload"][href="${PUP_URL}"]`;
    if (document.head.querySelector(selector)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "fetch";
    link.crossOrigin = "anonymous";
    link.href = PUP_URL;
    document.head.append(link);
  }, []);
}
