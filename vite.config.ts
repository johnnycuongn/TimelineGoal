import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      pwaAssets: { config: true },
      manifest: {
        name: "CoupleGoal",
        short_name: "CoupleGoal",
        description: "Small taps, big dreams, one pup. Goals for the two of you.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        lang: "en",
        background_color: "#fdf2f8",
        theme_color: "#fdf2f8",
        categories: ["lifestyle"],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
