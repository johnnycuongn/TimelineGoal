import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const ONE_YEAR_SECONDS = 31_536_000;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
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
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/models\/.*\.glb$/,
            handler: "CacheFirst",
            options: {
              cacheName: "pup-model",
              expiration: { maxEntries: 2, maxAgeSeconds: ONE_YEAR_SECONDS },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: ONE_YEAR_SECONDS },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
