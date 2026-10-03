/// <reference lib="webworker" />
// Replaces the generated worker so it can show pushes. Caching is exactly what
// generateSW did before: precache the build, fall back to index.html for page loads
// (not /api/), keep the pup model for a year, and refresh fonts in the background.
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { notificationFromPush, safePath } from "./lib/push-payload";

declare let self: ServiceWorkerGlobalScope;

const ONE_YEAR_SECONDS = 31_536_000;

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//] }),
);
registerRoute(
  ({ url }) => /\/models\/.*\.glb$/.test(url.pathname),
  new CacheFirst({
    cacheName: "pup-model",
    plugins: [new ExpirationPlugin({ maxEntries: 2, maxAgeSeconds: ONE_YEAR_SECONDS })],
  }),
);
registerRoute(
  ({ url }) => /^fonts\.(googleapis|gstatic)\.com$/i.test(url.hostname),
  new StaleWhileRevalidate({
    cacheName: "fonts",
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: ONE_YEAR_SECONDS })],
  }),
);

self.addEventListener("push", (event) => {
  const view = notificationFromPush(event.data?.text() ?? null);
  event.waitUntil(
    self.registration.showNotification(view.title, {
      body: view.body,
      tag: view.tag,
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      data: { url: view.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data?.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows[0];
      if (open) {
        await open.focus();
        await open.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
