# CoupleGoal (Supabase + Vite PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CoupleGoal, the couples goal app from the TimelineGoal web spec (daily habits, monthly/quarterly/yearly milestones with a ladder, share-code pairing, a realistic animated 3D bulldog puppy), as a mobile-first installable PWA on a Supabase + Vite + Vercel stack.

**Architecture:** A single Vite React single-page app talks to Supabase directly with the publishable key. Postgres tables scoped by `couple_id` are protected by row-level security; the invariants the spec puts on the server (two members, one paw per partner per day, owner-only stamping, ladder rule, seal rules, day tolerance) live in constraint triggers and three `security definer` RPCs (create den, join den, mint code). All progress maths, mood derivation and view shaping stay pure TypeScript in the browser, fed by one couple-wide fetch that Supabase Realtime and SWR keep fresh. The pup is a lazy-loaded React Three Fiber canvas. Vercel serves the static build plus one tiny cron function that keeps the free Supabase project awake.

**Tech Stack:** Node 22 + npm, Vite 7, React 19, TypeScript 5.9, React Router 7 (library mode), Tailwind 4 + Radix primitives, `motion` 13, `swr` 2, `@supabase/supabase-js` 2, `next-themes`, `sonner`, `lucide-react`, three 0.186 + `@react-three/fiber` 9.7 + `@react-three/drei` 10.7, `vite-plugin-pwa` 1 + `@vite-pwa/assets-generator` 1, Biome 2, Vitest 4, `@gltf-transform/cli` 4.5 (one-off), Supabase (Postgres, Auth, Realtime) in `ap-southeast-2`, Vercel Hobby.

**Spec:** `docs/superpowers/specs/2026-09-17-timelinegoal-web-design.md` (product rules, pages, goals model, pup, theme and motion tokens). This plan replaces the spec's "Core decisions", "Data model (MongoDB)", "Server functions", "Client data flow", "Testing" and "Deployment notes" sections with the stack below; everything else in the spec is implemented as written.

## Stack delta from the spec

| Spec said | This plan does | Why |
| --- | --- | --- |
| TanStack Start on Cloudflare Workers, Bun monorepo | Vite SPA, npm, one package, static on Vercel | No server bundle to fight; best base for a PWA and for three.js |
| Clerk | Supabase Auth, email + password | One vendor; sessions persist in an installed iPhone PWA. Magic links would open in Safari, not the installed app, so no OTP links |
| MongoDB via `@repo/mongo`, `withDb` per request | Postgres via supabase-js, RLS, triggers, RPCs | Invariants enforced in the database, no server code to host |
| Server functions (`me`, `pairing`, `goals`, `checkins`, `den`) | Direct table reads/writes + 3 RPCs; `den`/`timeline` shaped client-side from one fetch | A couple's data is a few hundred rows; one fetch, pure maths |
| Polling every 10s | Supabase Realtime `postgres_changes` on the couple's rows, plus SWR focus revalidation and a 60s fallback | Near-live for free; polling stays as the safety net |
| Product name TimelineGoal; Worker name `build-day-template-syd` | Product and repo name **CoupleGoal** (the user's folder name); pup voice still "Mochi" | User renamed the project |
| `bun test` + mongodb-memory-server | Vitest for pure modules; a signed-out RLS probe script; browser end-to-end | No Docker, no local Postgres required |
| Cloudflare `_headers` for the model | `vercel.json` headers + Workbox runtime cache | Same effect on Vercel, plus offline shell |
| (not in spec) | **PWA**: manifest, service worker, icons, iOS meta, safe-area layout, install hint, bottom tab bar on phones | User asked for install-on-iPhone and mobile responsive |

## Global Constraints

- **Rule 0 (secrets).** The app needs no secret at all: only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, both public by design. Never read, `cat`, `echo` or quote `.env.local`, and never paste a `sb_secret_`/`service_role` key anywhere in this repo or the transcript. `.gitignore` covers `.env*` (except `.env.example`) before the first commit. Run `python3 "/Users/johnnynguyen/Software/mvp-stack-plugin/skills/mvp-stack/scripts/audit_secrets.py" .` before every deploy; it must exit 0.
- **Rule 1 (mobile).** Every screen is built mobile-first and verified with the Playwright MCP at 320, 375, 768 and 1280 px: `document.documentElement.scrollWidth > document.documentElement.clientWidth` must be `false` at each width, then look at a 375 and a 1280 screenshot. Tap targets ≥ 44×44 px with 8 px between; inputs ≥ 16 px font; nothing hover-only (`@media (hover: hover)` for hover styling); `dvh` not `vh`; fixed bars padded with `env(safe-area-inset-*)`; `html, body { overflow-x: clip }`; dialogs become bottom sheets under 640 px. Verified means checked in a browser; otherwise say "mobile layout unverified".
- **Design.** Hallmark is installed at `.claude/skills/hallmark/` (third-party MIT design skill). The visual system is the spec's rose theme, defined once as tokens in `src/styles.css`; every colour and font in components references a token (`var(--primary)`, `font-heading`), never a raw hex. Hallmark is used in Task 13 for the landing page and a polish pass; app screens follow the spec's cuteness rules and Rule 1.
- **Tooling.** Node 22 (`.nvmrc` = `22`; `export PATH="$HOME/.nvm/versions/node/v22.12.0/bin:$PATH"` before every command in this session), npm. Run commands from the repo root `~/Software/Projects/CoupleGoal`. Check step for every task: `npm run fix && npm run check && npm test` (Biome fix, Biome check + `tsc --noEmit`, Vitest). Commit with explicit paths, never `git add -A`. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Product rules (spec).** Exactly two members per couple; all goals visible to both; no partner comparison; no red "failed" states; copy warm, first-person plural, in the pup's voice, never guilt. Lucide icons only; emoji only as user charms. Horizons `day | month | quarter | year`; periods `2026-09`, `2026-Q3`, `2026`; habits have no period. Milestone targets 1–20, titles 1–80 chars, pup name ≤ 24, display name ≤ 40, charm ≤ 16 UTF-16 units. Share codes: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Days are the browser's local `YYYY-MM-DD`; the database accepts a day within ±1 of its own `current_date`.
- **Theme tokens (light):** background `#FDF2F8`, card `#FFFFFF`, muted `#FBF1F5`, border `#F7E3EB`, foreground `#0F172A`, muted-foreground `#6B5561`, primary `#BE185D`, primary-foreground `#FFFFFF`, secondary `#EC4899`, destructive `#DC2626`, success `#15803D`, ring `#BE185D`. **Dark:** background `#181015`, card `#241820`, muted `#2E1F28`, border `#3D2A34`, foreground `#F6E9EF`, muted-foreground `#C8AAB8`, primary `#F472B6`, primary-foreground `#3B0A22`, secondary `#F9A8D4`, destructive `#F87171`, success `#4ADE80`, ring `#F472B6`. Fonts Fredoka (headings) / Nunito (body), base 16px, line-height ≥ 1.5, card radius 20–24px, pill buttons. Partner palette rose `#BE185D`/`#F472B6`, teal `#0D9488`/`#2DD4BF`, blueberry `#4F46E5`/`#818CF8`, tangerine `#EA580C`/`#FB923C`, grape `#7C3AED`/`#A78BFA`, lime `#4D7C0F`/`#A3E635`, sky `#0284C7`/`#38BDF8`.
- **Motion tokens:** `spring.default {damping 15, stiffness 150}`, `spring.press {damping 18, stiffness 320, mass 0.7}` with press scale 0.96, `spring.bouncy {damping 9, stiffness 180, mass 0.9}`; enter 250ms / exit 170ms opacity only; list stagger 40ms; reduced motion → 120ms fades, no confetti, pup frozen on `Idle`. No animation over 400ms blocks input.
- **Pup:** clips `Idle`, `Idle_2`, `Idle_2_HeadLow`, `Walk`, `Gallop_Jump`, `Eating`, `Idle_HitReact_Left`, `Idle_HitReact_Right`; idle weights `Idle 8 (6–12s), Idle_2 4 (5–9s), Eating 3 (4–8s), Walk 3 (3–6s)`; crossfade 0.35s; no third-party CDN fetches at runtime (no drei `Environment` presets, no Draco CDN). Credit ships visibly: "Bulldog Puppy" by doinspire, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); skeleton and animations by Quaternius (CC0).
- **Database rules.** Every table has RLS enabled in the same migration that creates it. Migrations live in `supabase/migrations/` and in git; nothing is clicked into the dashboard except the one auth toggle in Task 3. Every couple-scoped table carries `couple_id` (denormalised where needed) so Realtime filters and policies stay one-column. User-facing error copy is raised from triggers/RPCs with `raise exception` and shown as-is by the client.
- **Supabase free tier (checked Sep 2026):** 500 MB database, 50k MAU, 2 active projects, no card, hard caps. It pauses after 7 idle days; Task 14's Vercel cron keeps it awake. **Vercel Hobby:** non-commercial only (this app is personal use), 100 GB transfer, 2 cron jobs at most once a day.

---

## File structure

```
CoupleGoal/
  package.json, package-lock.json, .nvmrc, .gitignore, .env.example, .env.local (ignored)
  index.html, vite.config.ts, vitest.config.ts, pwa-assets.config.ts, vercel.json
  tsconfig.json, tsconfig.app.json, tsconfig.node.json, biome.json
  README.md, CLAUDE.md
  api/keepalive.ts                     Vercel cron function: pings Supabase so the free project never pauses
  supabase/migrations/
    0001_schema.sql                    tables, enum, indexes, helper functions
    0002_rules.sql                     constraint triggers (members ≤ 2, ladder rule, paw rules, seals, reactions)
    0003_rls.sql                       RLS policies and grants
    0004_rpc.sql                       create_den, join_den, mint_invite_code
    0005_realtime.sql                  publication + replica identity
  scripts/rls-probe.mjs                signed-out probe: every table must return zero rows
  public/icon.svg                      PWA icon source; generated icons land in public/
  public/models/pup.glb, public/models/LICENSE.md
  src/
    main.tsx                           providers + router
    routes.tsx                         route table and guards
    styles.css                         tokens, fonts, layout helpers, bottom-sheet dialogs
    lib/
      domain.ts                        types + constants (Horizon, Goal, CheckIn, Member, Couple, palette, limits)
      periods.ts (+ test)              day keys and period maths
      ladder.ts (+ test)               progress rollups and habit states
      share-code.ts (+ test)           normalise / validate share codes (generation is in SQL)
      mood.ts (+ test)                 persistent mood derivation
      views.ts (+ test)                denView / timelineView: CoupleData -> what pages render
      goals.ts                         parentCandidates
      day.ts                           localDayKey
      motion.ts                        spring/timing tokens
      utils.ts                         cn()
      supabase.ts                      the client (publishable key)
      database.types.ts                generated by Supabase
      errors.ts                        friendlyError(): Postgres/auth error -> copy
    auth/auth-provider.tsx             session state, signIn/signUp/signOut
    data/
      mappers.ts                       rows -> domain objects
      queries.ts                       fetchCoupleData, fetchMe
      mutations.ts                     every write, one function each
      use-me.ts                        who am I, which den
      use-couple-data.ts               SWR + Realtime subscription
    hooks/
      use-resolved-theme.ts, use-habit-toggle.ts, den-diff.ts (+ test), use-partner-activity.ts, use-is-standalone.ts
    components/
      ui/ (button, input, label, card, dialog, dropdown-menu, tabs, native-select)   hand-written Radix wrappers
      app-shell.tsx                    header, bottom tab bar, outlet
      theme-toggle.tsx, partner-dot.tsx, color-picker.tsx, install-hint.tsx, error-panel.tsx
      goals/ (paw-row, habit-card, horizon-tabs, new-goal-dialog, milestone-card, seal-dialog, period-picker, goal-menu)
      den/ (today-strip, ticker)
      pup/ (idle-scheduler (+ test), pup-mood-context, pup-url, pup-model, pup-stage, pup, confetti)
    pages/ (landing, login, pair, den, timeline, us)
```

---

## Stage 1: Foundation

### Task 1: Scaffold the app, theme, UI primitives, PWA shell, Vercel config

**Files:**
- Create: `package.json`, `.nvmrc`, `.gitignore`, `.env.example`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `pwa-assets.config.ts`, `vercel.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `biome.json`
- Create: `public/icon.svg`, `src/main.tsx`, `src/routes.tsx`, `src/styles.css`, `src/lib/utils.ts`, `src/lib/motion.ts`, `src/hooks/use-resolved-theme.ts`, `src/components/theme-toggle.tsx`, `src/components/app-shell.tsx`, `src/components/error-panel.tsx`, `src/components/ui/{button,input,label,card,dialog,dropdown-menu,tabs,native-select}.tsx`, `src/pages/landing.tsx`
- Delete: nothing (the repo holds only `docs/` and `.claude/` so far)

**Interfaces:**
- Produces: `cn()`, `springs`, `timings`, `PRESS_SCALE`; `useResolvedTheme(): "light" | "dark"`; `<AppShell />` renders header + bottom tabs + `<Outlet />`; UI primitives with the same names/props the later tasks use: `Button({ variant: "default"|"secondary"|"outline"|"ghost", size: "default"|"sm"|"icon", asChild })`, `Input`, `Label`, `Card`/`CardHeader`/`CardContent`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`, `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`, `Tabs`/`TabsList`/`TabsTrigger`, `NativeSelect`; CSS classes `page-wrap`, `island-shell`, `island-kicker`, `display-title`, `nav-link`.

- [ ] **Step 1: Package manifest and configs**

`.nvmrc`: `22`. `.gitignore`:

```
node_modules
dist
dev-dist
.vercel
.env
.env.*
!.env.example
.DS_Store
.playwright-mcp
*.local
```

`.env.example` (public values, committed):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`package.json`:

```json
{
  "name": "couplegoal",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.app.json --noEmit && vite build",
    "preview": "vite preview",
    "check": "biome check . && tsc -p tsconfig.app.json --noEmit",
    "fix": "biome check --write .",
    "test": "vitest run",
    "pwa-assets": "pwa-assets-generator",
    "rls-probe": "node scripts/rls-probe.mjs"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-tabs": "^1.1.13",
    "@supabase/supabase-js": "^2.116.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.47.0",
    "motion": "^13.4.0",
    "next-themes": "^0.4.6",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-router": "^7.18.4",
    "sonner": "^2.0.8",
    "swr": "^2.5.1",
    "tailwind-merge": "^3.7.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.5.14",
    "@tailwindcss/vite": "^4.3.3",
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vercel/node": "^13.0.1",
    "@vite-pwa/assets-generator": "^1.0.0",
    "@vitejs/plugin-react": "^5.2.0",
    "tailwindcss": "^4.3.3",
    "tw-animate-css": "^1.4.0",
    "typescript": "~5.9.3",
    "vite": "^7.3.6",
    "vite-plugin-pwa": "^1.3.0",
    "vitest": "^4.1.11"
  }
}
```

(Three.js packages arrive in Task 10.) `tsconfig.json`:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "types": ["vite/client", "vite-plugin-pwa/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "api"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.config.ts", "pwa-assets.config.ts"]
}
```

`biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.14/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "includes": ["**", "!src/lib/database.types.ts", "!dev-dist/**", "!dist/**", "!public/**"] },
  "formatter": { "enabled": true, "indentStyle": "space", "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "double" } },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "a11y": { "recommended": true },
      "correctness": { "useExhaustiveDependencies": "warn" }
    }
  },
  "overrides": [
    {
      "includes": ["src/components/pup/**"],
      "linter": { "rules": { "suspicious": { "noUnknownAttribute": "off" } } }
    }
  ]
}
```

If `biome check` reports `noUnknownAttribute` as an unknown rule in the installed Biome, delete the `overrides` block; it only matters once Task 11 adds R3F JSX, and the rule can be re-added then under whatever group Biome lists it in (`npx biome explain noUnknownAttribute`).

`vite.config.ts`:

```ts
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
            options: { cacheName: "fonts", expiration: { maxEntries: 20, maxAgeSeconds: ONE_YEAR_SECONDS } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
```

`vitest.config.ts`:

```ts
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: { environment: "node", include: ["src/**/*.test.ts"] },
  })
);
```

`pwa-assets.config.ts`:

```ts
import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  preset: minimal2023Preset,
  images: ["public/icon.svg"],
});
```

`public/icon.svg` (rose rounded square, white paw; the maskable safe zone is the inner 80%):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#be185d"/>
  <g fill="#fff">
    <ellipse cx="256" cy="322" rx="92" ry="78"/>
    <circle cx="164" cy="214" r="38"/>
    <circle cx="226" cy="160" r="38"/>
    <circle cx="286" cy="160" r="38"/>
    <circle cx="348" cy="214" r="38"/>
  </g>
</svg>
```

`vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/models/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/manifest.webmanifest", "headers": [{ "key": "Content-Type", "value": "application/manifest+json" }] }
  ],
  "crons": [{ "path": "/api/keepalive", "schedule": "0 3 */3 * *" }]
}
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>CoupleGoal</title>
    <meta name="description" content="Small taps, big dreams, one pup. Goals for the two of you." />
    <meta name="theme-color" content="#fdf2f8" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#181015" media="(prefers-color-scheme: dark)" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="CoupleGoal" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400..700&family=Nunito:wght@400..800&display=swap" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`vite-plugin-pwa` with `pwaAssets` injects the `<link rel="icon">`, `apple-touch-icon` and manifest links at build time, so none are hand-written here.

- [ ] **Step 2: Install and generate icons**

```bash
export PATH="$HOME/.nvm/versions/node/v22.12.0/bin:$PATH"
npm install
npm run pwa-assets
ls public
```

Expected: `public/` gains `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`. Commit them (they are small).

- [ ] **Step 3: Styles**

`src/styles.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* CoupleGoal tokens. Semantic only; components never use raw hex. */
:root {
  --radius: 1.25rem;
  --background: #fdf2f8;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #be185d;
  --primary-foreground: #ffffff;
  --secondary: #ec4899;
  --secondary-foreground: #ffffff;
  --muted: #fbf1f5;
  --muted-foreground: #6b5561;
  --accent: #fbf1f5;
  --accent-foreground: #0f172a;
  --destructive: #dc2626;
  --success: #15803d;
  --border: #f7e3eb;
  --input: #f7e3eb;
  --ring: #be185d;
  --tab-bar-height: 4.25rem;
}

/* Dark: desaturated rose, not inverted. */
.dark {
  --background: #181015;
  --foreground: #f6e9ef;
  --card: #241820;
  --card-foreground: #f6e9ef;
  --popover: #241820;
  --popover-foreground: #f6e9ef;
  --primary: #f472b6;
  --primary-foreground: #3b0a22;
  --secondary: #f9a8d4;
  --secondary-foreground: #3b0a22;
  --muted: #2e1f28;
  --muted-foreground: #c8aab8;
  --accent: #2e1f28;
  --accent-foreground: #f6e9ef;
  --destructive: #f87171;
  --success: #4ade80;
  --border: #3d2a34;
  --input: #3d2a34;
  --ring: #f472b6;
}

@theme inline {
  --font-sans: "Nunito", ui-sans-serif, system-ui, sans-serif;
  --font-heading: "Fredoka", "Nunito", ui-sans-serif, system-ui, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-success: var(--success);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 8px);
  --radius-md: calc(var(--radius) - 4px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html,
  body {
    overflow-x: clip;
  }
  html {
    -webkit-text-size-adjust: 100%;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
    min-height: 100dvh;
    font-size: 16px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  h1,
  h2,
  h3,
  h4 {
    @apply font-heading;
    font-style: normal;
  }
  input,
  select,
  textarea {
    font-size: 16px; /* iOS Safari zooms on focus below 16px */
  }
  img,
  canvas {
    max-width: 100%;
    height: auto;
  }
}

@layer components {
  .page-wrap {
    @apply mx-auto w-full max-w-5xl;
  }
  .island-shell {
    @apply rounded-[var(--radius-xl)] border border-border bg-card shadow-[0_10px_30px_-18px_rgb(190_24_93/0.35)];
  }
  .island-kicker {
    @apply font-heading text-primary text-xs font-semibold uppercase tracking-[0.18em];
  }
  .display-title {
    @apply font-heading font-semibold tracking-[-0.01em];
    text-wrap: balance;
  }
  .nav-link {
    @apply relative inline-flex min-h-11 items-center px-1 text-muted-foreground no-underline;
  }
  .nav-link::after {
    content: "";
    @apply absolute inset-x-1 bottom-2 h-0.5 origin-left scale-x-0 rounded-full bg-primary transition-transform;
  }
  .nav-link.is-active {
    @apply text-foreground;
  }
  .nav-link.is-active::after {
    @apply scale-x-100;
  }
  @media (hover: hover) {
    .nav-link:hover {
      @apply text-foreground;
    }
  }
  /* Room for the fixed tab bar on phones. */
  .with-tab-bar {
    padding-bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 1rem);
  }
  @media (min-width: 768px) {
    .with-tab-bar {
      padding-bottom: 3rem;
    }
  }
  .tab-bar {
    padding-bottom: env(safe-area-inset-bottom);
    height: calc(var(--tab-bar-height) + env(safe-area-inset-bottom));
  }
  .safe-top {
    padding-top: env(safe-area-inset-top);
  }
  /* Dialogs become bottom sheets on phones. */
  @media (max-width: 639px) {
    [data-slot="dialog-content"] {
      top: auto;
      bottom: 0;
      left: 0;
      right: 0;
      transform: none;
      width: 100%;
      max-width: 100%;
      max-height: 90dvh;
      overflow-y: auto;
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
      padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Small libs and hooks**

`src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

`src/lib/motion.ts`:

```ts
// Motion tokens from the spec. Every spatial animation uses a spring; enter
// and exit use opacity-only timings.
export const springs = {
  default: { type: "spring", damping: 15, stiffness: 150, mass: 1 },
  press: { type: "spring", damping: 18, stiffness: 320, mass: 0.7 },
  bouncy: { type: "spring", damping: 9, stiffness: 180, mass: 0.9 },
} as const;

export const timings = {
  enterMs: 250,
  exitMs: 170,
  staggerMs: 40,
  reducedMotionFadeMs: 120,
} as const;

export const PRESS_SCALE = 0.96;
```

`src/hooks/use-resolved-theme.ts`:

```ts
import { useTheme } from "next-themes";

export function useResolvedTheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "dark" : "light";
}
```

`src/components/theme-toggle.tsx`:

```tsx
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";

export default function ThemeToggle() {
  const { setTheme } = useTheme();
  const theme = useResolvedTheme();
  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [setTheme, theme]);
  return (
    <Button aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggle} size="icon" type="button" variant="ghost">
      {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}
```

- [ ] **Step 5: UI primitives (hand-written Radix wrappers)**

These live in `src/components/ui/` and are ours to edit. `button.tsx`:

```tsx
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 font-heading font-semibold text-base transition-[transform,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground active:scale-[0.96]",
        secondary: "bg-secondary text-secondary-foreground active:scale-[0.96]",
        outline: "border border-border bg-card text-foreground active:scale-[0.96]",
        ghost: "text-foreground hover:bg-muted active:scale-[0.96]",
      },
      size: {
        default: "min-h-11 px-5",
        sm: "min-h-11 px-4 text-sm",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} data-slot="button" {...props} />;
}
```

`input.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex min-h-11 w-full rounded-2xl border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className
      )}
      data-slot="input"
      {...props}
    />
  );
}
```

`label.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block font-semibold text-sm", className)} data-slot="label" {...props} />;
}
```

`card.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("island-shell p-5 sm:p-6", className)} data-slot="card" {...props} />;
}
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mb-4 space-y-1", className)} data-slot="card-header" {...props} />;
}
export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("", className)} data-slot="card-content" {...props} />;
}
```

`dialog.tsx`:

```tsx
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-xl)] border border-border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className
        )}
        data-slot="dialog-content"
        {...props}
      >
        {children}
        <DialogPrimitive.Close aria-label="Close" className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mb-4 space-y-1 pr-10", className)} {...props} />;
}
export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("display-title text-2xl", className)} {...props} />;
}
export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-muted-foreground text-sm", className)} {...props} />;
}
```

`dropdown-menu.tsx`:

```tsx
import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        className={cn("z-50 min-w-48 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg", className)}
        sideOffset={6}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      className={cn("flex min-h-11 cursor-default select-none items-center rounded-xl px-3 text-sm outline-none data-[highlighted]:bg-muted", className)}
      {...props}
    />
  );
}
```

`tabs.tsx`:

```tsx
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("grid w-full grid-cols-4 gap-1 rounded-full bg-muted p-1", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "min-h-11 rounded-full font-heading font-semibold text-muted-foreground text-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  );
}
```

`native-select.tsx`:

```tsx
import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "flex min-h-11 w-full appearance-none rounded-2xl border border-input bg-card px-4 pr-10 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          className
        )}
        data-slot="native-select"
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
```

- [ ] **Step 6: App shell, error panel, landing placeholder, router, main**

`src/components/error-panel.tsx` (used by the router as `errorElement` and by pages when Supabase is unreachable):

```tsx
import { isRouteErrorResponse, useRouteError } from "react-router";

export function ErrorPanel({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell max-w-3xl p-6 sm:p-8">
        <p className="island-kicker mb-3">Hmm</p>
        <h1 className="display-title mb-4 text-3xl">We couldn't reach the den</h1>
        <p className="m-0 text-muted-foreground text-sm leading-7">
          Usually this means the database is asleep or the connection dropped. Pull to refresh, or
          try again in a moment.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-muted p-3 text-xs">{message}</pre>
      </section>
    </main>
  );
}

export default function RouteErrorPanel() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return <ErrorPanel error={new Error(`${error.status} ${error.statusText}`)} />;
  }
  return <ErrorPanel error={error} />;
}
```

`src/components/app-shell.tsx`. Top header everywhere; on phones the nav is a fixed bottom tab bar, on `md+` the links sit in the header. Task 4 adds the signed-in bits (sign-out); for now it renders nav for everyone so the layout can be checked:

```tsx
import { Heart, Home, Mountain, PawPrint } from "lucide-react";
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
    isActive ? "text-primary" : "text-muted-foreground"
  );
}

export default function AppShell({ showNav = true, right }: { showNav?: boolean; right?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top sticky top-0 z-40 border-border border-b bg-background/90 px-4 backdrop-blur-lg">
        <nav className="page-wrap flex items-center gap-3 py-2">
          <NavLink className="inline-flex min-h-11 items-center gap-2 font-heading text-foreground text-xl no-underline" to="/">
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
        <nav aria-label="Main" className="tab-bar fixed inset-x-0 bottom-0 z-40 flex items-start gap-1 border-border border-t bg-background/95 px-2 pt-1 backdrop-blur-lg md:hidden">
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
```

`src/pages/landing.tsx` (placeholder; Task 13 designs the real one):

```tsx
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <section className="page-wrap pt-10 pb-8 sm:pt-16">
      <p className="island-kicker mb-4">For the two of you</p>
      <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.05] sm:text-6xl">Small taps, big dreams, one pup.</h1>
      <p className="mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg">
        Keep your daily habits and your yearly dreams in one cosy place, and let your pup cheer every paw print.
      </p>
      <Button asChild>
        <Link to="/login">Sign in</Link>
      </Button>
    </section>
  );
}
```

`src/routes.tsx` (Task 4 adds guards and the real pages):

```tsx
import { createBrowserRouter } from "react-router";
import AppShell from "@/components/app-shell";
import RouteErrorPanel from "@/components/error-panel";
import LandingPage from "@/pages/landing";

function Placeholder({ title }: { title: string }) {
  return (
    <section className="page-wrap py-10">
      <h1 className="display-title text-3xl">{title}</h1>
    </section>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteErrorPanel />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/login", element: <Placeholder title="Login" /> },
      { path: "/pair", element: <Placeholder title="Pair" /> },
      { path: "/den", element: <Placeholder title="Den" /> },
      { path: "/goals", element: <Placeholder title="Timeline" /> },
      { path: "/us", element: <Placeholder title="Us" /> },
    ],
  },
]);
```

`src/main.tsx`:

```tsx
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
  </StrictMode>
);
```

- [ ] **Step 7: Check, run, verify mobile**

```bash
npm run fix && npm run check
npm run build && ls dist
npm run dev
```

Expected: check clean; `dist/` contains `sw.js`, `manifest.webmanifest`, `index.html` with injected icon links. Dev server on `http://localhost:5173`. With the Playwright MCP: open `/`, resize to 320, 375, 768, 1280 and evaluate `document.documentElement.scrollWidth > document.documentElement.clientWidth` → `false` each time; screenshot 375 (bottom tab bar visible, Fredoka heading, rose background) and 1280 (links in the header, no tab bar). Toggle dark → background `#181015`. `npm run preview` then open `/manifest.webmanifest` → JSON with the icons; Chrome DevTools → Application → Manifest shows "Installable".

- [ ] **Step 8: First commit**

```bash
git add .nvmrc .gitignore .env.example package.json package-lock.json index.html vite.config.ts vitest.config.ts pwa-assets.config.ts vercel.json tsconfig.json tsconfig.app.json tsconfig.node.json biome.json public src docs .claude
git commit -m "Scaffold CoupleGoal: Vite PWA shell, rose theme, UI primitives

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

`.claude/skills/hallmark/` and `.claude/skills-lock.json` are committed so the design skill travels with the repo.

---

### Task 2: Domain types and the pure modules (periods, share codes, mood, ladder)

**Files:**
- Create: `src/lib/domain.ts`, `src/lib/periods.ts`, `src/lib/periods.test.ts`, `src/lib/share-code.ts`, `src/lib/share-code.test.ts`, `src/lib/mood.ts`, `src/lib/mood.test.ts`, `src/lib/ladder.ts`, `src/lib/ladder.test.ts`, `src/lib/day.ts`, `src/lib/goals.ts`

**Interfaces:**
- Produces (`domain.ts`): `HORIZONS`, `Horizon`, `MilestoneHorizon`, `Mood`, `PARTNER_COLORS`, `PartnerColorKey`, `partnerColorKeys`, `DEFAULT_COLOR_A`, `SHARED_OWNER`, `GOAL_TITLE_MAX`, `GOAL_TARGET_MIN`, `GOAL_TARGET_MAX`, `PUP_NAME_MAX`, `DISPLAY_NAME_MAX`, `SHARE_CODE_LENGTH`, `TICKER_LIMIT`, `Member`, `Couple`, `Goal`, `GoalInput`, `CheckIn`, `TickerItem`, `CoupleData`, `isSealed(goal, memberIds)`.
- Produces (`periods.ts`): `dayKeyFromDate`, `isValidDayKey`, `shiftDay`, `daysBetween`, `periodFor`, `isValidPeriod`, `horizonOfPeriod`, `periodRange`, `periodContainsDay`, `daysElapsedInPeriod`, `shiftPeriod`, `periodLabel`, `parentHorizon`, `childHorizon`, `isDayWithinTolerance`.
- Produces (`share-code.ts`): `SHARE_CODE_ALPHABET`, `normalizeShareCode`, `isValidShareCode`.
- Produces (`mood.ts`): `PersistentMood`, `derivePersistentMood({ lastCheckInAt, todayCount, now })`, `SLEEPY_HOUR`, `POUT_AFTER_DAYS`.
- Produces (`ladder.ts`): `CheckInLite`, `GoalProgress`, `HabitState` (with `stripDays`), `computeProgress`, `computeHabitStates`, `habitFraction`, `filledPaws`.
- Produces (`day.ts`): `localDayKey(now?)`; (`goals.ts`): `parentCandidates(goals, horizon, today)`.

- [ ] **Step 1: `domain.ts`**

```ts
// Browser-side domain model. Rows from Supabase are mapped into these shapes
// once (src/data/mappers.ts); everything else in the app speaks this language.

export const HORIZONS = ["day", "month", "quarter", "year"] as const;
export type Horizon = (typeof HORIZONS)[number];
export type MilestoneHorizon = Exclude<Horizon, "day">;

export type Mood = "idle" | "happy" | "party" | "proud" | "sleepy" | "pout" | "love";

export const PARTNER_COLORS = {
  rose: { light: "#BE185D", dark: "#F472B6" },
  teal: { light: "#0D9488", dark: "#2DD4BF" },
  blueberry: { light: "#4F46E5", dark: "#818CF8" },
  tangerine: { light: "#EA580C", dark: "#FB923C" },
  grape: { light: "#7C3AED", dark: "#A78BFA" },
  lime: { light: "#4D7C0F", dark: "#A3E635" },
  sky: { light: "#0284C7", dark: "#38BDF8" },
} as const;
export type PartnerColorKey = keyof typeof PARTNER_COLORS;
export const partnerColorKeys = Object.keys(PARTNER_COLORS) as PartnerColorKey[];
export const DEFAULT_COLOR_A: PartnerColorKey = "rose";

export function isPartnerColorKey(value: string): value is PartnerColorKey {
  return value in PARTNER_COLORS;
}

/** `owner` on a Goal is a member id or this sentinel. */
export const SHARED_OWNER = "shared";
export const GOAL_TITLE_MAX = 80;
export const GOAL_TARGET_MIN = 1;
export const GOAL_TARGET_MAX = 20;
export const PUP_NAME_MAX = 24;
export const DISPLAY_NAME_MAX = 40;
export const SHARE_CODE_LENGTH = 6;
export const TICKER_LIMIT = 10;
export const MAX_MEMBERS = 2;

export interface Member {
  id: string;
  displayName: string;
  color: PartnerColorKey;
}

export interface Couple {
  id: string;
  pupName: string | null;
  anniversary: string | null;
  inviteCode: string | null;
  createdBy: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  coupleId: string;
  title: string;
  charm: string | null;
  horizon: Horizon;
  /** A member id, or "shared". */
  owner: string;
  /** Milestones only; null for daily habits. */
  period: string | null;
  /** Milestones only; null for daily habits. */
  targetUnits: number | null;
  parentGoalId: string | null;
  /** Shared goals: member id -> ISO date they pressed the wax. */
  seals: Record<string, string>;
  createdBy: string;
  createdAt: string;
  archivedAt: string | null;
}

export interface GoalInput {
  title: string;
  charm: string | null;
  horizon: Horizon;
  owner: string;
  targetUnits: number | null;
  parentGoalId: string | null;
}

export interface CheckIn {
  id: string;
  coupleId: string;
  goalId: string;
  uid: string;
  day: string;
  at: string;
  horizon: Horizon;
  reactions: Record<string, "heart">;
}

/** Ticker entry: a check-in joined with its goal. */
export interface TickerItem {
  checkinId: string;
  uid: string;
  goalId: string;
  goalTitle: string;
  charm: string | null;
  at: string;
  reactions: Record<string, "heart">;
}

/** Everything one fetch returns for a couple. */
export interface CoupleData {
  couple: Couple;
  members: Member[];
  goals: Goal[];
  /** Check-ins since 1 January of the viewed year, newest first. */
  checkins: CheckIn[];
}

export function isSealed(goal: Goal, memberIds: string[]): boolean {
  return goal.owner === SHARED_OWNER && memberIds.every((m) => goal.seals[m]);
}
```

- [ ] **Step 2: Failing period tests**

`src/lib/periods.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  childHorizon,
  dayKeyFromDate,
  daysBetween,
  daysElapsedInPeriod,
  horizonOfPeriod,
  isDayWithinTolerance,
  isValidDayKey,
  isValidPeriod,
  parentHorizon,
  periodContainsDay,
  periodFor,
  periodLabel,
  periodRange,
  shiftDay,
  shiftPeriod,
} from "./periods";

describe("day keys", () => {
  test("dayKeyFromDate uses UTC parts", () => {
    expect(dayKeyFromDate(new Date(Date.UTC(2026, 8, 17, 23, 30)))).toBe("2026-09-17");
  });

  test("isValidDayKey", () => {
    expect(isValidDayKey("2026-09-17")).toBe(true);
    expect(isValidDayKey("2026-13-01")).toBe(false);
    expect(isValidDayKey("2026-02-30")).toBe(false);
    expect(isValidDayKey("26-09-17")).toBe(false);
  });

  test("shiftDay crosses month and year ends", () => {
    expect(shiftDay("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });

  test("daysBetween is signed", () => {
    expect(daysBetween("2026-09-01", "2026-09-17")).toBe(16);
    expect(daysBetween("2026-09-17", "2026-09-01")).toBe(-16);
  });

  test("isDayWithinTolerance allows one day either side", () => {
    const now = new Date(Date.UTC(2026, 8, 17, 12));
    expect(isDayWithinTolerance("2026-09-16", now, 1)).toBe(true);
    expect(isDayWithinTolerance("2026-09-18", now, 1)).toBe(true);
    expect(isDayWithinTolerance("2026-09-19", now, 1)).toBe(false);
  });
});

describe("periods", () => {
  test("periodFor", () => {
    expect(periodFor("month", "2026-09-17")).toBe("2026-09");
    expect(periodFor("quarter", "2026-09-17")).toBe("2026-Q3");
    expect(periodFor("quarter", "2026-12-31")).toBe("2026-Q4");
    expect(periodFor("year", "2026-09-17")).toBe("2026");
  });

  test("isValidPeriod and horizonOfPeriod", () => {
    expect(isValidPeriod("2026-09")).toBe(true);
    expect(isValidPeriod("2026-Q3")).toBe(true);
    expect(isValidPeriod("2026")).toBe(true);
    expect(isValidPeriod("2026-Q5")).toBe(false);
    expect(isValidPeriod("2026-00")).toBe(false);
    expect(horizonOfPeriod("2026-09")).toBe("month");
    expect(horizonOfPeriod("2026-Q3")).toBe("quarter");
    expect(horizonOfPeriod("2026")).toBe("year");
  });

  test("periodRange is inclusive", () => {
    expect(periodRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(periodRange("2028-02").end).toBe("2028-02-29");
    expect(periodRange("2026-Q3")).toEqual({ start: "2026-07-01", end: "2026-09-30" });
    expect(periodRange("2026")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  test("periodContainsDay", () => {
    expect(periodContainsDay("2026-09", "2026-09-30")).toBe(true);
    expect(periodContainsDay("2026-09", "2026-10-01")).toBe(false);
  });

  test("daysElapsedInPeriod counts through today, capped at the period", () => {
    expect(daysElapsedInPeriod("2026-09", "2026-09-17")).toBe(17);
    expect(daysElapsedInPeriod("2026-09", "2026-10-15")).toBe(30);
    expect(daysElapsedInPeriod("2026-09", "2026-08-15")).toBe(0);
  });

  test("shiftPeriod", () => {
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-Q4", 1)).toBe("2027-Q1");
    expect(shiftPeriod("2026", -2)).toBe("2024");
  });

  test("periodLabel", () => {
    expect(periodLabel("2026-09")).toBe("September 2026");
    expect(periodLabel("2026-Q3")).toBe("Q3 2026");
    expect(periodLabel("2026")).toBe("2026");
  });

  test("horizon relations", () => {
    expect(parentHorizon("day")).toBe("month");
    expect(parentHorizon("year")).toBeNull();
    expect(childHorizon("month")).toBe("day");
    expect(childHorizon("day")).toBeNull();
  });
});
```

Run `npm test -- periods`. Expected: FAIL, cannot resolve `./periods`.

- [ ] **Step 3: `periods.ts`**

```ts
// Day keys are "YYYY-MM-DD"; periods are "YYYY-MM", "YYYY-Qn" or "YYYY".
// All arithmetic runs on UTC dates built from the key parts, so results never
// depend on the machine's timezone. The browser decides what "today" is.
import { HORIZONS, type Horizon, type MilestoneHorizon } from "./domain";

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const QUARTER_RE = /^(\d{4})-Q([1-4])$/;
const YEAR_RE = /^(\d{4})$/;
const MS_PER_DAY = 86_400_000;
const MONTHS_PER_QUARTER = 3;
const MONTHS_PER_YEAR = 12;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const pad = (n: number): string => String(n).padStart(2, "0");

function toUtc(day: string): Date {
  const match = DAY_RE.exec(day);
  if (!match) {
    throw new Error(`Invalid day key: ${day}`);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function dayKeyFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isValidDayKey(value: string): boolean {
  if (!DAY_RE.test(value)) {
    return false;
  }
  return dayKeyFromDate(toUtc(value)) === value;
}

export function shiftDay(day: string, delta: number): string {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + delta);
  return dayKeyFromDate(date);
}

/** Signed number of days from `a` to `b`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / MS_PER_DAY);
}

export function isDayWithinTolerance(day: string, now: Date, toleranceDays: number): boolean {
  if (!isValidDayKey(day)) {
    return false;
  }
  return Math.abs(daysBetween(dayKeyFromDate(now), day)) <= toleranceDays;
}

export function periodFor(horizon: MilestoneHorizon, day: string): string {
  const date = toUtc(day);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (horizon === "month") {
    return `${year}-${pad(month)}`;
  }
  if (horizon === "quarter") {
    return `${year}-Q${Math.ceil(month / MONTHS_PER_QUARTER)}`;
  }
  return String(year);
}

export function isValidPeriod(value: string): boolean {
  const month = MONTH_RE.exec(value);
  if (month) {
    const m = Number(month[2]);
    return m >= 1 && m <= MONTHS_PER_YEAR;
  }
  return QUARTER_RE.test(value) || YEAR_RE.test(value);
}

export function horizonOfPeriod(period: string): MilestoneHorizon {
  if (MONTH_RE.test(period)) {
    return "month";
  }
  if (QUARTER_RE.test(period)) {
    return "quarter";
  }
  if (YEAR_RE.test(period)) {
    return "year";
  }
  throw new Error(`Invalid period: ${period}`);
}

/** First and last month (1-based) of a period, with its year. */
function monthSpan(period: string): { year: number; first: number; last: number } {
  const month = MONTH_RE.exec(period);
  if (month) {
    const m = Number(month[2]);
    return { year: Number(month[1]), first: m, last: m };
  }
  const quarter = QUARTER_RE.exec(period);
  if (quarter) {
    const q = Number(quarter[2]);
    const first = (q - 1) * MONTHS_PER_QUARTER + 1;
    return { year: Number(quarter[1]), first, last: first + MONTHS_PER_QUARTER - 1 };
  }
  const year = YEAR_RE.exec(period);
  if (year) {
    return { year: Number(year[1]), first: 1, last: MONTHS_PER_YEAR };
  }
  throw new Error(`Invalid period: ${period}`);
}

export function periodRange(period: string): { start: string; end: string } {
  const { year, first, last } = monthSpan(period);
  const start = new Date(Date.UTC(year, first - 1, 1));
  // Day 0 of the following month is the last day of `last`.
  const end = new Date(Date.UTC(year, last, 0));
  return { start: dayKeyFromDate(start), end: dayKeyFromDate(end) };
}

export function periodContainsDay(period: string, day: string): boolean {
  const { start, end } = periodRange(period);
  return day >= start && day <= end;
}

/** Days from the period start through `today`, clamped to [0, length]. */
export function daysElapsedInPeriod(period: string, today: string): number {
  const { start, end } = periodRange(period);
  if (today < start) {
    return 0;
  }
  const last = today < end ? today : end;
  return daysBetween(start, last) + 1;
}

export function shiftPeriod(period: string, delta: number): string {
  const horizon = horizonOfPeriod(period);
  const { year, first } = monthSpan(period);
  if (horizon === "year") {
    return String(year + delta);
  }
  const step = horizon === "month" ? 1 : MONTHS_PER_QUARTER;
  const date = new Date(Date.UTC(year, first - 1 + delta * step, 1));
  return periodFor(horizon, dayKeyFromDate(date));
}

export function periodLabel(period: string): string {
  const horizon = horizonOfPeriod(period);
  const { year, first } = monthSpan(period);
  if (horizon === "month") {
    return `${MONTH_NAMES[first - 1]} ${year}`;
  }
  if (horizon === "quarter") {
    return `Q${Math.ceil(first / MONTHS_PER_QUARTER)} ${year}`;
  }
  return String(year);
}

export function parentHorizon(horizon: Horizon): Horizon | null {
  const index = HORIZONS.indexOf(horizon);
  return HORIZONS[index + 1] ?? null;
}

export function childHorizon(horizon: Horizon): Horizon | null {
  const index = HORIZONS.indexOf(horizon);
  return index > 0 ? (HORIZONS[index - 1] ?? null) : null;
}
```

`src/lib/day.ts` (the browser's local day; the only place local time becomes a key):

```ts
const pad = (n: number): string => String(n).padStart(2, "0");

/** Today's key in the visitor's local time zone. */
export function localDayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
```

`src/lib/goals.ts`:

```ts
import type { Goal, Horizon } from "./domain";
import { parentHorizon, periodFor } from "./periods";

/** Active goals one horizon up from `horizon`, in the period that contains `today`. */
export function parentCandidates(goals: Goal[], horizon: Horizon, today: string): Goal[] {
  const up = parentHorizon(horizon);
  if (!up || up === "day") {
    return [];
  }
  const period = periodFor(up, today);
  return goals.filter((g) => g.horizon === up && g.period === period && g.archivedAt === null);
}
```

Run `npm test -- periods`: pass.

- [ ] **Step 4: Share code and mood tests, then implementations**

`src/lib/share-code.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { isValidShareCode, normalizeShareCode } from "./share-code";

describe("share codes", () => {
  test("normalizeShareCode uppercases and strips spaces and dashes", () => {
    expect(normalizeShareCode(" ab-c d2e ")).toBe("ABCD2E");
  });

  test("isValidShareCode rejects ambiguous glyphs and wrong lengths", () => {
    expect(isValidShareCode("ABCD23")).toBe(true);
    expect(isValidShareCode("ABCD0O")).toBe(false);
    expect(isValidShareCode("ABC")).toBe(false);
    expect(isValidShareCode("abcd23")).toBe(false);
  });
});
```

`src/lib/mood.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { derivePersistentMood } from "./mood";

const at = (h: number) => new Date(2026, 8, 17, h, 0, 0);

describe("derivePersistentMood", () => {
  test("idle by default, including a brand-new couple in the evening", () => {
    expect(derivePersistentMood({ lastCheckInAt: null, todayCount: 0, now: at(21) })).toBe("idle");
  });

  test("sleepy after 20:00 local with nothing stamped today", () => {
    const recent = new Date(2026, 8, 16, 12).toISOString();
    expect(derivePersistentMood({ lastCheckInAt: recent, todayCount: 0, now: at(20) })).toBe("sleepy");
    expect(derivePersistentMood({ lastCheckInAt: recent, todayCount: 1, now: at(20) })).toBe("idle");
    expect(derivePersistentMood({ lastCheckInAt: recent, todayCount: 0, now: at(19) })).toBe("idle");
  });

  test("pout after three quiet days, and it beats sleepy", () => {
    const old = new Date(2026, 8, 13, 12).toISOString();
    expect(derivePersistentMood({ lastCheckInAt: old, todayCount: 0, now: at(10) })).toBe("pout");
    expect(derivePersistentMood({ lastCheckInAt: old, todayCount: 0, now: at(21) })).toBe("pout");
  });
});
```

Run `npm test -- share-code mood`: FAIL. Then `src/lib/share-code.ts` (generation lives in SQL, `fresh_share_code()`, Task 3):

```ts
import { SHARE_CODE_LENGTH } from "./domain";

/** No 0/O, 1/I so a code read aloud or typed from a photo never misfires. */
export const SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RE = new RegExp(`^[${SHARE_CODE_ALPHABET}]{${SHARE_CODE_LENGTH}}$`);
const STRIP_RE = /[\s-]/g;

export function normalizeShareCode(input: string): string {
  return input.replace(STRIP_RE, "").toUpperCase();
}

export function isValidShareCode(code: string): boolean {
  return CODE_RE.test(code);
}
```

`src/lib/mood.ts`:

```ts
// The pup's persistent mood. Derived on the client from Den data and local
// time, so the database knows nothing about moods.
export const SLEEPY_HOUR = 20;
export const POUT_AFTER_DAYS = 3;
const MS_PER_DAY = 86_400_000;

export type PersistentMood = "idle" | "sleepy" | "pout";

// A couple with no check-ins yet (lastCheckInAt null) stays idle: a brand-new
// den should never open on a sleepy or pouting pup.
export function derivePersistentMood(input: {
  lastCheckInAt: string | null;
  todayCount: number;
  now: Date;
}): PersistentMood {
  const { lastCheckInAt, todayCount, now } = input;
  if (lastCheckInAt) {
    const quietDays = (now.getTime() - new Date(lastCheckInAt).getTime()) / MS_PER_DAY;
    if (quietDays >= POUT_AFTER_DAYS) {
      return "pout";
    }
    if (todayCount === 0 && now.getHours() >= SLEEPY_HOUR) {
      return "sleepy";
    }
  }
  return "idle";
}
```

Run `npm test -- share-code mood`: pass.

- [ ] **Step 5: Ladder tests, then `ladder.ts`**

`src/lib/ladder.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { Goal } from "./domain";
import { type CheckInLite, computeHabitStates, computeProgress, filledPaws } from "./ladder";

const A = "user_a";
const B = "user_b";

function goal(partial: Partial<Goal> & Pick<Goal, "id" | "horizon">): Goal {
  return {
    coupleId: "c1",
    title: partial.id,
    charm: null,
    owner: A,
    period: null,
    targetUnits: null,
    parentGoalId: null,
    seals: {},
    createdBy: A,
    createdAt: "2026-09-01T00:00:00.000Z",
    archivedAt: null,
    ...partial,
  };
}

const ci = (goalId: string, uid: string, day: string): CheckInLite => ({ goalId, uid, day });

function get<T>(record: Record<string, T>, key: string): T {
  const value = record[key];
  if (!value) {
    throw new Error(`missing ${key}`);
  }
  return value;
}

describe("computeProgress", () => {
  test("own stamps within the period count, others do not", () => {
    const goals = [goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 4 })];
    const checkins = [ci("m", A, "2026-09-02"), ci("m", A, "2026-09-05"), ci("m", A, "2026-08-30")];
    const p = computeProgress(goals, checkins, "2026-09-17");
    expect(p.m).toEqual({ own: 2, ladder: 0, progress: 2, target: 4, complete: false });
  });

  test("a completed child adds one paw to its parent", () => {
    const goals = [
      goal({ id: "q", horizon: "quarter", period: "2026-Q3", targetUnits: 3 }),
      goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 2, parentGoalId: "q" }),
    ];
    const checkins = [ci("m", A, "2026-09-02"), ci("m", A, "2026-09-05")];
    const p = computeProgress(goals, checkins, "2026-09-17");
    expect(get(p, "m").complete).toBe(true);
    expect(get(p, "q").ladder).toBe(1);
    expect(get(p, "q").progress).toBe(1);
  });

  test("a habit kept every day so far contributes one paw", () => {
    const goals = [
      goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 2 }),
      goal({ id: "h", horizon: "day", parentGoalId: "m" }),
    ];
    const checkins = ["01", "02", "03"].map((d) => ci("h", A, `2026-09-${d}`));
    const p = computeProgress(goals, checkins, "2026-09-03");
    expect(get(p, "m").ladder).toBe(1);
  });

  test("a half-kept habit contributes half a paw; either partner counts", () => {
    const goals = [
      goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 2 }),
      goal({ id: "h", horizon: "day", owner: "shared", parentGoalId: "m" }),
    ];
    const checkins = [ci("h", A, "2026-09-01"), ci("h", B, "2026-09-01"), ci("h", B, "2026-09-03")];
    const p = computeProgress(goals, checkins, "2026-09-04");
    expect(get(p, "m").ladder).toBe(0.5);
  });

  test("progress is capped at target and marks complete; ladder recurses", () => {
    const goals = [
      goal({ id: "y", horizon: "year", period: "2026", targetUnits: 1 }),
      goal({ id: "q", horizon: "quarter", period: "2026-Q3", targetUnits: 1, parentGoalId: "y" }),
      goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 1, parentGoalId: "q" }),
    ];
    const checkins = [ci("m", A, "2026-09-02"), ci("y", A, "2026-09-02")];
    const p = computeProgress(goals, checkins, "2026-09-17");
    expect(get(p, "q").complete).toBe(true);
    expect(p.y).toEqual({ own: 1, ladder: 1, progress: 1, target: 1, complete: true });
  });

  test("archived children are ignored", () => {
    const goals = [
      goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 2 }),
      goal({ id: "h", horizon: "day", parentGoalId: "m", archivedAt: "2026-09-10T00:00:00.000Z" }),
    ];
    const p = computeProgress(goals, [ci("h", A, "2026-09-01")], "2026-09-01");
    expect(get(p, "m").ladder).toBe(0);
  });

  test("filledPaws floors", () => {
    expect(filledPaws({ own: 1, ladder: 0.5, progress: 1.5, target: 3, complete: false })).toBe(1);
  });
});

describe("computeHabitStates", () => {
  test("today flag per member and a 7-day strip ending today", () => {
    const goals = [goal({ id: "h", horizon: "day", owner: "shared" })];
    const checkins = [ci("h", A, "2026-09-17"), ci("h", B, "2026-09-15"), ci("h", B, "2026-09-16")];
    const s = computeHabitStates(goals, checkins, "2026-09-17", [A, B]);
    expect(get(s, "h").todayBy).toEqual({ [A]: true, [B]: false });
    expect(get(s, "h").last7[A]).toEqual([false, false, false, false, false, false, true]);
    expect(get(s, "h").last7[B]).toEqual([false, false, false, false, true, true, false]);
    expect(get(s, "h").stripDays).toEqual([
      "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17",
    ]);
  });

  test("streakDays counts consecutive days ending today (or yesterday) with any stamp", () => {
    const goals = [goal({ id: "h", horizon: "day" })];
    const three = ["15", "16", "17"].map((d) => ci("h", A, `2026-09-${d}`));
    expect(get(computeHabitStates(goals, three, "2026-09-17", [A]), "h").streakDays).toBe(3);
    expect(get(computeHabitStates(goals, three, "2026-09-18", [A]), "h").streakDays).toBe(3);
    expect(get(computeHabitStates(goals, three, "2026-09-19", [A]), "h").streakDays).toBe(0);
  });
});
```

Run `npm test -- ladder`: FAIL. Then `src/lib/ladder.ts`:

```ts
// Pure progress maths for the Timeline and the Den.
import type { Goal } from "./domain";
import { daysElapsedInPeriod, periodContainsDay, shiftDay } from "./periods";

export interface CheckInLite {
  goalId: string;
  uid: string;
  day: string;
}

export interface GoalProgress {
  own: number;
  ladder: number;
  progress: number;
  target: number;
  complete: boolean;
}

export interface HabitState {
  todayBy: Record<string, boolean>;
  last7: Record<string, boolean[]>;
  /** The 7 day keys `last7` covers, oldest first. */
  stripDays: string[];
  streakDays: number;
}

const EPSILON = 1e-9;
const STRIP_DAYS = 7;

function byGoal(checkins: CheckInLite[]): Map<string, CheckInLite[]> {
  const map = new Map<string, CheckInLite[]>();
  for (const c of checkins) {
    const list = map.get(c.goalId);
    if (list) {
      list.push(c);
    } else {
      map.set(c.goalId, [c]);
    }
  }
  return map;
}

/** Distinct days (by any member) a habit was stamped inside `period`, up to today. */
export function habitFraction(goal: Goal, checkins: CheckInLite[], period: string, today: string): number {
  const elapsed = daysElapsedInPeriod(period, today);
  if (elapsed === 0) {
    return 0;
  }
  const days = new Set<string>();
  for (const c of checkins) {
    if (c.goalId === goal.id && c.day <= today && periodContainsDay(period, c.day)) {
      days.add(c.day);
    }
  }
  return Math.min(1, days.size / elapsed);
}

export function computeProgress(goals: Goal[], checkins: CheckInLite[], today: string): Record<string, GoalProgress> {
  const active = goals.filter((g) => g.archivedAt === null);
  const grouped = byGoal(checkins);
  const children = new Map<string, Goal[]>();
  for (const g of active) {
    if (g.parentGoalId) {
      const list = children.get(g.parentGoalId);
      if (list) {
        list.push(g);
      } else {
        children.set(g.parentGoalId, [g]);
      }
    }
  }

  const memo = new Map<string, GoalProgress>();

  const progressOf = (goal: Goal): GoalProgress => {
    const cached = memo.get(goal.id);
    if (cached) {
      return cached;
    }
    const period = goal.period ?? "";
    const target = goal.targetUnits ?? 1;
    const own = Math.min(target, (grouped.get(goal.id) ?? []).filter((c) => periodContainsDay(period, c.day)).length);
    let ladder = 0;
    for (const child of children.get(goal.id) ?? []) {
      if (child.horizon === "day") {
        ladder += habitFraction(child, grouped.get(child.id) ?? [], period, today);
      } else {
        const p = progressOf(child);
        ladder += Math.min(1, p.progress / p.target);
      }
    }
    const progress = Math.min(target, own + ladder);
    const result: GoalProgress = { own, ladder, progress, target, complete: progress + EPSILON >= target };
    memo.set(goal.id, result);
    return result;
  };

  const out: Record<string, GoalProgress> = {};
  for (const g of active) {
    if (g.horizon !== "day") {
      out[g.id] = progressOf(g);
    }
  }
  return out;
}

export function filledPaws(progress: GoalProgress): number {
  return Math.floor(progress.progress + EPSILON);
}

export function computeHabitStates(
  goals: Goal[],
  checkins: CheckInLite[],
  today: string,
  memberIds: string[]
): Record<string, HabitState> {
  const grouped = byGoal(checkins);
  const stripDays: string[] = [];
  for (let i = STRIP_DAYS - 1; i >= 0; i -= 1) {
    stripDays.push(shiftDay(today, -i));
  }
  const out: Record<string, HabitState> = {};
  for (const g of goals) {
    if (g.horizon !== "day" || g.archivedAt !== null) {
      continue;
    }
    const stamps = grouped.get(g.id) ?? [];
    const todayBy: Record<string, boolean> = {};
    const last7: Record<string, boolean[]> = {};
    for (const uid of memberIds) {
      const mine = new Set(stamps.filter((c) => c.uid === uid).map((c) => c.day));
      todayBy[uid] = mine.has(today);
      last7[uid] = stripDays.map((d) => mine.has(d));
    }
    const anyDays = new Set(stamps.map((c) => c.day));
    let streakDays = 0;
    let cursor = anyDays.has(today) ? today : shiftDay(today, -1);
    while (anyDays.has(cursor)) {
      streakDays += 1;
      cursor = shiftDay(cursor, -1);
    }
    out[g.id] = { todayBy, last7, stripDays, streakDays };
  }
  return out;
}
```

- [ ] **Step 6: Run everything and commit**

```bash
npm run fix && npm run check && npm test
git add src/lib
git commit -m "Add domain types and pure period, ladder, share-code and mood modules

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Expected: 4 test files, all green.

---

### Task 3: Supabase project, schema, rules, RLS, RPCs, Realtime, client

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `0002_rules.sql`, `0003_rls.sql`, `0004_rpc.sql`, `0005_realtime.sql`
- Create: `src/lib/supabase.ts`, `src/lib/database.types.ts` (generated), `src/lib/errors.ts`, `src/vite-env.d.ts`, `scripts/rls-probe.mjs`, `.env.local` (git-ignored, public values only)

**Interfaces:**
- Produces: tables `couples`, `members`, `goals`, `goal_seals`, `checkins`, `reactions`, `keepalive`; enum `horizon`; SQL functions `my_couple_id()`, `period_range(text)`, `period_horizon(text)`, `parent_horizon(horizon)`; RPCs `create_den(p_display_name, p_color) → { couple_id, invite_code }`, `join_den(p_code, p_display_name, p_color) → uuid`, `mint_invite_code() → text`; `supabase` client typed with `Database`; `friendlyError(error: unknown): string`.
- Error copy raised by the database (the client shows these verbatim): `This den already has two people in it.`, `Your partner already has that colour.`, `Daily habits have no period or target.`, `That period does not match the horizon.`, `Milestones need a paw target.`, `The owner must be in this den.`, `That bigger goal is not in this den.`, `A goal can only climb toward the horizon just above it.`, `That bigger goal belongs to a different stretch of time.`, `That bigger goal is not for this month.`, `Only shared goals get a seal.`, `Only the two of you can seal this.`, `That goal is tucked away.`, `You are not in this den.`, `Only the owner stamps this one.`, `Your clock and ours disagree. Reload and try again.`, `That goal belongs to another stretch of time.`, `Every paw is already on this one.`, `You can only heart your partner's paw prints.`, `Sign in first.`, `You already have a den.`, `That code isn't waiting for anyone. Ask your partner for a fresh one.`, `You are not in a den yet.`, `Your den is already full, no code needed.`, `Could not mint a code, try again.`

- [ ] **Step 1: `0001_schema.sql`**

```sql
-- CoupleGoal schema. Every couple-scoped table carries couple_id so RLS and
-- Realtime filters are one column. Invariants live in 0002_rules.sql.
create extension if not exists pgcrypto;

create type public.horizon as enum ('day', 'month', 'quarter', 'year');

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  pup_name text check (pup_name is null or char_length(pup_name) between 1 and 24),
  anniversary date,
  invite_code text unique check (invite_code is null or invite_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  color text not null check (color in ('rose', 'teal', 'blueberry', 'tangerine', 'grape', 'lime', 'sky')),
  joined_at timestamptz not null default now()
);
create index members_couple_idx on public.members (couple_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  charm text check (charm is null or char_length(charm) between 1 and 16),
  horizon public.horizon not null,
  owner_id uuid references auth.users (id) on delete set null, -- null = shared
  period text,
  target_units int check (target_units is null or target_units between 1 and 20),
  parent_goal_id uuid references public.goals (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index goals_couple_idx on public.goals (couple_id, horizon, period);

create table public.goal_seals (
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  sealed_at timestamptz not null default now(),
  primary key (goal_id, user_id)
);
create index goal_seals_couple_idx on public.goal_seals (couple_id);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  horizon public.horizon not null,
  at timestamptz not null default now()
);
-- One habit paw per partner per day; milestones may take several stamps a day.
create unique index checkins_one_paw_per_day on public.checkins (goal_id, user_id, day) where horizon = 'day';
create index checkins_couple_at_idx on public.checkins (couple_id, at desc);
create index checkins_goal_idx on public.checkins (goal_id);

create table public.reactions (
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  kind text not null default 'heart' check (kind = 'heart'),
  created_at timestamptz not null default now(),
  primary key (checkin_id, user_id)
);
create index reactions_couple_idx on public.reactions (couple_id);

-- Pinged by the Vercel cron so the free project never pauses.
create table public.keepalive (id int primary key);
insert into public.keepalive (id) values (1);

-- Helpers -------------------------------------------------------------------

-- The caller's den. security definer so member policies can call it without recursing into themselves.
create or replace function public.my_couple_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select couple_id from public.members where user_id = auth.uid()
$$;
revoke execute on function public.my_couple_id() from public, anon;
grant execute on function public.my_couple_id() to authenticated;

create or replace function public.period_horizon(p text)
returns public.horizon
language sql immutable
set search_path = ''
as $$
  select case
    when p ~ '^\d{4}$' then 'year'::public.horizon
    when p ~ '^\d{4}-Q[1-4]$' then 'quarter'::public.horizon
    when p ~ '^\d{4}-(0[1-9]|1[0-2])$' then 'month'::public.horizon
  end
$$;

create or replace function public.period_range(p text)
returns daterange
language plpgsql immutable
set search_path = ''
as $$
declare
  y int;
  m int;
  q int;
  first_day date;
begin
  if p ~ '^\d{4}$' then
    y := p::int;
    return daterange(make_date(y, 1, 1), make_date(y, 12, 31), '[]');
  elsif p ~ '^\d{4}-Q[1-4]$' then
    y := left(p, 4)::int;
    q := right(p, 1)::int;
    first_day := make_date(y, (q - 1) * 3 + 1, 1);
    return daterange(first_day, (first_day + interval '3 months' - interval '1 day')::date, '[]');
  elsif p ~ '^\d{4}-(0[1-9]|1[0-2])$' then
    y := left(p, 4)::int;
    m := right(p, 2)::int;
    first_day := make_date(y, m, 1);
    return daterange(first_day, (first_day + interval '1 month' - interval '1 day')::date, '[]');
  end if;
  raise exception 'Invalid period %', p;
end
$$;

create or replace function public.parent_horizon(h public.horizon)
returns public.horizon
language sql immutable
set search_path = ''
as $$
  select case h
    when 'day' then 'month'::public.horizon
    when 'month' then 'quarter'::public.horizon
    when 'quarter' then 'year'::public.horizon
    else null
  end
$$;
```

- [ ] **Step 2: `0002_rules.sql`**

```sql
-- Invariants from the spec, enforced where the data lives. Trigger functions
-- are security definer so they can read sibling rows regardless of RLS.

create or replace function public.members_limit()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.members where couple_id = new.couple_id) >= 2 then
    raise exception 'This den already has two people in it.';
  end if;
  if exists (
    select 1 from public.members
    where couple_id = new.couple_id and color = new.color and user_id <> new.user_id
  ) then
    raise exception 'Your partner already has that colour.';
  end if;
  return new;
end
$$;
create trigger members_limit before insert or update on public.members
  for each row execute function public.members_limit();

create or replace function public.goals_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  parent public.goals;
  up public.horizon;
  parent_changed boolean;
begin
  if new.horizon = 'day' then
    if new.period is not null or new.target_units is not null then
      raise exception 'Daily habits have no period or target.';
    end if;
  else
    if new.period is null or public.period_horizon(new.period) is distinct from new.horizon then
      raise exception 'That period does not match the horizon.';
    end if;
    if new.target_units is null then
      raise exception 'Milestones need a paw target.';
    end if;
  end if;

  if new.owner_id is not null and not exists (
    select 1 from public.members where user_id = new.owner_id and couple_id = new.couple_id
  ) then
    raise exception 'The owner must be in this den.';
  end if;

  parent_changed := tg_op = 'INSERT' or new.parent_goal_id is distinct from old.parent_goal_id;
  if new.parent_goal_id is not null and parent_changed then
    select * into parent from public.goals where id = new.parent_goal_id;
    up := public.parent_horizon(new.horizon);
    if parent.id is null or parent.couple_id <> new.couple_id or parent.archived_at is not null then
      raise exception 'That bigger goal is not in this den.';
    end if;
    if up is null or parent.horizon <> up then
      raise exception 'A goal can only climb toward the horizon just above it.';
    end if;
    if new.horizon <> 'day' and not (public.period_range(parent.period) @> public.period_range(new.period)) then
      raise exception 'That bigger goal belongs to a different stretch of time.';
    end if;
    -- A habit links to the parent that contains today (UTC, with a day of grace for time zones).
    if new.horizon = 'day'
       and not (public.period_range(parent.period) @> current_date or public.period_range(parent.period) @> (current_date + 1)) then
      raise exception 'That bigger goal is not for this month.';
    end if;
  end if;
  return new;
end
$$;
create trigger goals_validate before insert or update on public.goals
  for each row execute function public.goals_validate();

-- Creating a shared goal records the creator's seal.
create or replace function public.goals_autoseal()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.owner_id is null then
    insert into public.goal_seals (goal_id, user_id, couple_id)
    values (new.id, new.created_by, new.couple_id)
    on conflict do nothing;
  end if;
  return new;
end
$$;
create trigger goals_autoseal after insert on public.goals
  for each row execute function public.goals_autoseal();

create or replace function public.goal_seals_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.goals;
begin
  select * into g from public.goals where id = new.goal_id;
  if g.id is null or g.owner_id is not null then
    raise exception 'Only shared goals get a seal.';
  end if;
  if not exists (select 1 from public.members where user_id = new.user_id and couple_id = g.couple_id) then
    raise exception 'Only the two of you can seal this.';
  end if;
  new.couple_id := g.couple_id;
  return new;
end
$$;
create trigger goal_seals_validate before insert on public.goal_seals
  for each row execute function public.goal_seals_validate();

create or replace function public.checkins_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.goals;
  r daterange;
  stamped int;
begin
  select * into g from public.goals where id = new.goal_id;
  if g.id is null or g.archived_at is not null then
    raise exception 'That goal is tucked away.';
  end if;
  if not exists (select 1 from public.members where user_id = new.user_id and couple_id = g.couple_id) then
    raise exception 'You are not in this den.';
  end if;
  if g.owner_id is not null and g.owner_id <> new.user_id then
    raise exception 'Only the owner stamps this one.';
  end if;
  if new.day < current_date - 1 or new.day > current_date + 1 then
    raise exception 'Your clock and ours disagree. Reload and try again.';
  end if;
  new.couple_id := g.couple_id;
  new.horizon := g.horizon;
  if g.horizon <> 'day' then
    r := public.period_range(g.period);
    if not (r @> new.day) then
      raise exception 'That goal belongs to another stretch of time.';
    end if;
    select count(*) into stamped from public.checkins where goal_id = g.id and r @> day;
    if stamped >= g.target_units then
      raise exception 'Every paw is already on this one.';
    end if;
  end if;
  return new;
end
$$;
create trigger checkins_validate before insert on public.checkins
  for each row execute function public.checkins_validate();

create or replace function public.reactions_validate()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.checkins;
begin
  select * into c from public.checkins where id = new.checkin_id;
  if c.id is null or not exists (select 1 from public.members where user_id = new.user_id and couple_id = c.couple_id) then
    raise exception 'You are not in this den.';
  end if;
  if c.user_id = new.user_id then
    raise exception 'You can only heart your partner''s paw prints.';
  end if;
  new.couple_id := c.couple_id;
  return new;
end
$$;
create trigger reactions_validate before insert on public.reactions
  for each row execute function public.reactions_validate();
```

- [ ] **Step 3: `0003_rls.sql`**

`with check` runs after `before` row triggers, so the `couple_id` the triggers fill in is what the policy sees.

```sql
alter table public.couples enable row level security;
alter table public.members enable row level security;
alter table public.goals enable row level security;
alter table public.goal_seals enable row level security;
alter table public.checkins enable row level security;
alter table public.reactions enable row level security;
alter table public.keepalive enable row level security;

-- couples: members read; members may edit pup_name and anniversary only; rows are created by RPC.
create policy "members read their couple" on public.couples
  for select to authenticated using (id = public.my_couple_id());
create policy "members update their couple" on public.couples
  for update to authenticated using (id = public.my_couple_id()) with check (id = public.my_couple_id());
revoke insert, update, delete on public.couples from authenticated, anon;
grant update (pup_name, anniversary) on public.couples to authenticated;

-- members: read your den; edit your own name and colour; joining happens via RPC.
create policy "members read their den" on public.members
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "members edit themselves" on public.members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and couple_id = public.my_couple_id());
revoke insert, update, delete on public.members from authenticated, anon;
grant update (display_name, color) on public.members to authenticated;

-- goals: both partners see and edit every goal in the den; nothing is deleted (archive instead).
create policy "members read goals" on public.goals
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "members create goals" on public.goals
  for insert to authenticated with check (couple_id = public.my_couple_id() and created_by = auth.uid());
create policy "members update goals" on public.goals
  for update to authenticated using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());
revoke delete on public.goals from authenticated, anon;

-- seals: read; press your own; never removed.
create policy "members read seals" on public.goal_seals
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "members press their seal" on public.goal_seals
  for insert to authenticated with check (user_id = auth.uid() and couple_id = public.my_couple_id());
revoke update, delete on public.goal_seals from authenticated, anon;

-- checkins: read; stamp as yourself; undo your own (habits: today only, with the same day of grace).
create policy "members read checkins" on public.checkins
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "members stamp as themselves" on public.checkins
  for insert to authenticated with check (user_id = auth.uid() and couple_id = public.my_couple_id());
create policy "members undo their own" on public.checkins
  for delete to authenticated using (user_id = auth.uid() and (horizon <> 'day' or day >= current_date - 1));
revoke update on public.checkins from authenticated, anon;

-- reactions: read; heart as yourself; hearts are forever.
create policy "members read reactions" on public.reactions
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "members heart as themselves" on public.reactions
  for insert to authenticated with check (user_id = auth.uid() and couple_id = public.my_couple_id());
revoke update, delete on public.reactions from authenticated, anon;

-- keepalive: anyone may ping.
create policy "anyone can ping" on public.keepalive
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.keepalive from authenticated, anon;
```

- [ ] **Step 4: `0004_rpc.sql`**

```sql
-- Pairing. All three run as the function owner (security definer) because
-- authenticated users have no insert grant on couples or members.

create or replace function public.gen_share_code()
returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1);
  end loop;
  return code;
end
$$;

create or replace function public.fresh_share_code()
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  code text;
  tries int := 0;
begin
  loop
    code := public.gen_share_code();
    exit when not exists (select 1 from public.couples where invite_code = code);
    tries := tries + 1;
    if tries > 20 then
      raise exception 'Could not mint a code, try again.';
    end if;
  end loop;
  return code;
end
$$;
revoke execute on function public.gen_share_code() from public, anon, authenticated;
revoke execute on function public.fresh_share_code() from public, anon, authenticated;

create or replace function public.create_den(p_display_name text, p_color text)
returns table (couple_id uuid, invite_code text)
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  code text;
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;
  if exists (select 1 from public.members where user_id = uid) then
    raise exception 'You already have a den.';
  end if;
  code := public.fresh_share_code();
  insert into public.couples (invite_code, created_by) values (code, uid) returning id into cid;
  insert into public.members (user_id, couple_id, display_name, color) values (uid, cid, p_display_name, p_color);
  return query select cid, code;
end
$$;

create or replace function public.join_den(p_code text, p_display_name text, p_color text)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  taken text;
  chosen text := p_color;
  palette constant text[] := array['rose', 'teal', 'blueberry', 'tangerine', 'grape', 'lime', 'sky'];
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;
  if exists (select 1 from public.members where user_id = uid) then
    raise exception 'You already have a den.';
  end if;
  -- Atomic: the row lock on the update means two joiners cannot both consume one code.
  update public.couples
     set invite_code = null
   where invite_code = upper(regexp_replace(p_code, '[\s-]', '', 'g'))
     and (select count(*) from public.members m where m.couple_id = public.couples.id) = 1
  returning id into cid;
  if cid is null then
    raise exception 'That code isn''t waiting for anyone. Ask your partner for a fresh one.';
  end if;
  select color into taken from public.members where couple_id = cid limit 1;
  if chosen = taken then
    select c into chosen from unnest(palette) with ordinality as t (c, ord) where c <> taken order by ord limit 1;
  end if;
  insert into public.members (user_id, couple_id, display_name, color) values (uid, cid, p_display_name, chosen);
  return cid;
end
$$;

create or replace function public.mint_invite_code()
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  code text;
begin
  select couple_id into cid from public.members where user_id = uid;
  if cid is null then
    raise exception 'You are not in a den yet.';
  end if;
  if (select count(*) from public.members where couple_id = cid) >= 2 then
    raise exception 'Your den is already full, no code needed.';
  end if;
  code := public.fresh_share_code();
  update public.couples set invite_code = code where id = cid;
  return code;
end
$$;

revoke execute on function public.create_den(text, text) from public, anon;
revoke execute on function public.join_den(text, text, text) from public, anon;
revoke execute on function public.mint_invite_code() from public, anon;
grant execute on function public.create_den(text, text) to authenticated;
grant execute on function public.join_den(text, text, text) to authenticated;
grant execute on function public.mint_invite_code() to authenticated;
```

- [ ] **Step 5: `0005_realtime.sql`**

```sql
-- Realtime: the client subscribes to postgres_changes on these tables filtered by
-- couple_id (couples by id). replica identity full puts couple_id on delete payloads.
alter publication supabase_realtime add table
  public.couples, public.members, public.goals, public.goal_seals, public.checkins, public.reactions;
alter table public.couples replica identity full;
alter table public.members replica identity full;
alter table public.goals replica identity full;
alter table public.goal_seals replica identity full;
alter table public.checkins replica identity full;
alter table public.reactions replica identity full;
```

- [ ] **Step 6: Provision the project with the Supabase MCP**

The Supabase MCP server is connected (doctor showed it). Use it rather than the CLI, so no database password is ever typed on a command line.

1. `list_organizations` → note the `id` of the user's organisation (ask with `AskUserQuestion` if there is more than one).
2. `get_cost` with `type: "project"` and that organisation → `confirm_cost` with the returned amount (free tier: 0) → `confirm_cost_id`.
3. `create_project` with `name: "couplegoal"`, `region: "ap-southeast-2"`, the organisation id and `confirm_cost_id`. Note the returned `id` (the project ref). Wait until `get_project` reports `status: ACTIVE_HEALTHY` (a minute or two).
4. Apply the migrations in order with `apply_migration` (`project_id`, `name` = the file's basename without extension, `query` = the file's full contents). Read each file with `cat` and pass the text; do not edit it in the call. If `0005` complains that a table is already in the publication, that is fine.
5. `get_advisors` with `type: "security"` and `type: "performance"` → expect no errors. If it flags "function search_path mutable", every function above already sets `search_path = ''`; fix any it names.
6. `get_project_url` and `get_publishable_keys` → write the two public values into `.env.local`:

```bash
cat > .env.local <<'ENV'
VITE_SUPABASE_URL=<url from get_project_url>
VITE_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_... from get_publishable_keys>
ENV
```

(Never write a `sb_secret_`/`service_role` key here; the app has no use for it.)

7. `generate_typescript_types` → save the returned text to `src/lib/database.types.ts`.
8. Connect the MCP to the project read-only for the rest of the build if it is account-wide: tell the user the command `claude mcp add --transport http supabase-couplegoal "https://mcp.supabase.com/mcp?project_ref=<ref>&read_only=true&features=database,docs,debugging"` is available; not required.

**One dashboard step, for the user:** in the Supabase dashboard open the `couplegoal` project → Authentication → Sign In / Providers → Email → turn **off** "Confirm email" → Save. With it on, `signUp` returns no session and the app would tell people to check an inbox that Supabase's built-in mailer only serves at 2 emails an hour. Ask the user to do this now (AskUserQuestion, one option "Done"), then continue.

- [ ] **Step 7: Client, env typing, error mapping**

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!(url && key)) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill both in."
  );
}

// The publishable key is the street address, not the door key: RLS guards every row.
export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
```

`src/lib/errors.ts`. Postgres `raise exception` text arrives as `PostgrestError.message`; auth errors have their own phrasing:

```ts
const NETWORK_COPY = "We couldn't reach the den. Check your connection and try again.";
const DEFAULT_COPY = "That didn't land. Try again?";
const DUPLICATE_CODE = "23505";

interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

/** Turns a Supabase/Postgres/auth error into copy the app can show as-is. */
export function friendlyError(error: unknown): string {
  if (error instanceof TypeError) {
    return NETWORK_COPY;
  }
  const e = (error ?? {}) as ErrorLike;
  if (e.code === DUPLICATE_CODE) {
    return "Already stamped.";
  }
  if (typeof e.message === "string" && e.message.length > 0) {
    if (e.message === "Failed to fetch") {
      return NETWORK_COPY;
    }
    if (e.message === "Invalid login credentials") {
      return "That email and password don't match. Try again?";
    }
    if (e.message.startsWith("Password should be")) {
      return "Pick a password with at least 6 characters.";
    }
    return e.message;
  }
  return DEFAULT_COPY;
}

export function isDuplicate(error: unknown): boolean {
  return (error as ErrorLike | null)?.code === DUPLICATE_CODE;
}
```

- [ ] **Step 8: Signed-out RLS probe**

`scripts/rls-probe.mjs` (run as `node --env-file=.env.local scripts/rls-probe.mjs`, so the values never pass through the transcript):

```js
// Signed out, the publishable key must see nothing in any couple table and
// exactly one keepalive row. Rows back from a couple table means RLS is off.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!(url && key)) {
  console.error("Missing env. Run: node --env-file=.env.local scripts/rls-probe.mjs");
  process.exit(2);
}
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const tables = ["couples", "members", "goals", "goal_seals", "checkins", "reactions"];
let failed = false;
for (const table of tables) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, { headers });
  const body = await res.json();
  const ok = res.ok && Array.isArray(body) && body.length === 0;
  console.log(`${ok ? "ok  " : "FAIL"} ${table}: ${res.status} ${Array.isArray(body) ? `${body.length} rows` : JSON.stringify(body)}`);
  failed ||= !ok;
}
const ping = await fetch(`${url}/rest/v1/keepalive?select=id`, { headers });
const rows = await ping.json();
const pingOk = ping.ok && Array.isArray(rows) && rows.length === 1;
console.log(`${pingOk ? "ok  " : "FAIL"} keepalive: ${ping.status}`);
failed ||= !pingOk;
const rpc = await fetch(`${url}/rest/v1/rpc/mint_invite_code`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" });
const rpcOk = !rpc.ok;
console.log(`${rpcOk ? "ok  " : "FAIL"} mint_invite_code refused signed-out: ${rpc.status}`);
failed ||= !rpcOk;
process.exit(failed ? 1 : 0);
```

Run: `node --env-file=.env.local scripts/rls-probe.mjs`. Expected: every line `ok`, exit 0.

- [ ] **Step 9: Check and commit**

```bash
npm run fix && npm run check && npm test
python3 "/Users/johnnynguyen/Software/mvp-stack-plugin/skills/mvp-stack/scripts/audit_secrets.py" .
git add supabase src/lib/supabase.ts src/lib/database.types.ts src/lib/errors.ts src/vite-env.d.ts scripts/rls-probe.mjs package.json
git commit -m "Add Supabase schema, rules, RLS, pairing RPCs and Realtime publication

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Expected: audit exits 0 (`.env.local` is ignored; nothing secret is tracked).

---

## Stage 2: A couple exists

### Task 4: Auth, who-am-I, route guards, login page, signed-in shell

**Files:**
- Create: `src/auth/auth-provider.tsx`, `src/data/mappers.ts`, `src/data/queries.ts` (the `fetchMe` half; Task 6 adds `fetchCoupleData`), `src/data/use-me.ts`, `src/data/den-context.tsx`, `src/pages/login.tsx`, `src/components/partner-dot.tsx`, `src/components/color-picker.tsx`
- Modify: `src/routes.tsx`, `src/main.tsx`, `src/components/app-shell.tsx`

**Interfaces:**
- Produces (`auth-provider.tsx`): `AuthProvider`, `useAuth(): { status: "loading" | "signed-out" | "signed-in"; userId: string | null; email: string | null; signIn(email, password): Promise<void>; signUp(email, password): Promise<void>; signOut(): Promise<void> }`.
- Produces (`mappers.ts`): `memberFromRow`, `coupleFromRow`, `goalFromRow(row, seals)`, `checkinFromRow(row, reactions)`; row types `MemberRow`, `CoupleRow`, `GoalRow`, `SealRow`, `CheckinRow`, `ReactionRow` from `Tables<...>`.
- Produces (`queries.ts`): `Me = { userId: string; couple: Couple | null; members: Member[] }`, `fetchMe(userId): Promise<Me>`.
- Produces (`use-me.ts`): `useMe(): { me: Me | undefined; error: unknown; isLoading: boolean; refresh(): Promise<Me | undefined> }` (SWR key `["me", userId]`).
- Produces (`den-context.tsx`): `DenMe = Me & { couple: Couple }`, `DenContext`, `useDen(): { me: DenMe; refresh(): Promise<Me | undefined> }` (its own module so pages never import `routes.tsx`, which imports the pages).
- Produces (`routes.tsx`): guards `RequireSession` (→ `/login`), `RequireDen` (→ `/pair`, provides the den context), `SignedOutOnly` (→ `/den` or `/pair`).
- Produces (components): `PartnerDot({ color, label, size? })`, `colorFor(key, theme)`, `ColorPicker({ value, onChange, taken? })`.

- [ ] **Step 1: Auth provider**

`src/auth/auth-provider.tsx`:

```tsx
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

type Status = "loading" | "signed-out" | "signed-in";

interface AuthValue {
  status: Status;
  userId: string | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? "signed-in" : "signed-out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? "signed-in" : "signed-out");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(friendlyError(error), { cause: error });
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      throw new Error(friendlyError(error), { cause: error });
    }
    if (!data.session) {
      throw new Error(
        "Your account exists but email confirmation is switched on in Supabase. Turn it off (README, Auth) or confirm from your inbox, then sign in."
      );
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      signIn,
      signUp,
      signOut,
    }),
    [status, session, signIn, signUp, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}
```

- [ ] **Step 2: Mappers and `fetchMe`**

`src/data/mappers.ts`:

```ts
import type { Tables } from "@/lib/database.types";
import {
  type CheckIn,
  type Couple,
  type Goal,
  isPartnerColorKey,
  type Member,
  SHARED_OWNER,
} from "@/lib/domain";

export type MemberRow = Tables<"members">;
export type CoupleRow = Tables<"couples">;
export type GoalRow = Tables<"goals">;
export type SealRow = Tables<"goal_seals">;
export type CheckinRow = Tables<"checkins">;
export type ReactionRow = Tables<"reactions">;

export function memberFromRow(row: MemberRow): Member {
  return {
    id: row.user_id,
    displayName: row.display_name,
    color: isPartnerColorKey(row.color) ? row.color : "rose",
  };
}

export function coupleFromRow(row: CoupleRow): Couple {
  return {
    id: row.id,
    pupName: row.pup_name,
    anniversary: row.anniversary,
    inviteCode: row.invite_code,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function goalFromRow(row: GoalRow, seals: SealRow[]): Goal {
  const mine = seals.filter((s) => s.goal_id === row.id);
  const sealMap: Record<string, string> = {};
  for (const s of mine) {
    sealMap[s.user_id] = s.sealed_at;
  }
  return {
    id: row.id,
    coupleId: row.couple_id,
    title: row.title,
    charm: row.charm,
    horizon: row.horizon,
    owner: row.owner_id ?? SHARED_OWNER,
    period: row.period,
    targetUnits: row.target_units,
    parentGoalId: row.parent_goal_id,
    seals: sealMap,
    createdBy: row.created_by,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

export function checkinFromRow(row: CheckinRow, reactions: ReactionRow[]): CheckIn {
  const mine: Record<string, "heart"> = {};
  for (const r of reactions) {
    if (r.checkin_id === row.id) {
      mine[r.user_id] = "heart";
    }
  }
  return {
    id: row.id,
    coupleId: row.couple_id,
    goalId: row.goal_id,
    uid: row.user_id,
    day: row.day,
    at: row.at,
    horizon: row.horizon,
    reactions: mine,
  };
}
```

`src/data/queries.ts` (Task 6 appends `fetchCoupleData`):

```ts
import type { Couple, Member } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { coupleFromRow, memberFromRow } from "./mappers";

export interface Me {
  userId: string;
  couple: Couple | null;
  members: Member[];
}

/** Who am I and which den am I in. RLS returns only my own den's rows. */
export async function fetchMe(userId: string): Promise<Me> {
  const { data: members, error } = await supabase.from("members").select("*").order("joined_at");
  if (error) {
    throw error;
  }
  const self = members.find((m) => m.user_id === userId);
  if (!self) {
    return { userId, couple: null, members: [] };
  }
  const { data: couple, error: coupleError } = await supabase
    .from("couples")
    .select("*")
    .eq("id", self.couple_id)
    .single();
  if (coupleError) {
    throw coupleError;
  }
  return { userId, couple: coupleFromRow(couple), members: members.map(memberFromRow) };
}
```

`src/data/use-me.ts`:

```ts
import useSWR from "swr";
import { useAuth } from "@/auth/auth-provider";
import { fetchMe, type Me } from "./queries";

export function useMe() {
  const { userId } = useAuth();
  const swr = useSWR<Me>(userId ? ["me", userId] : null, () => fetchMe(userId ?? ""), {
    revalidateOnFocus: true,
  });
  return { me: swr.data, error: swr.error, isLoading: swr.isLoading, refresh: swr.mutate };
}
```

- [ ] **Step 3: Partner dot and colour picker**

`src/components/partner-dot.tsx`:

```tsx
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { PARTNER_COLORS, type PartnerColorKey } from "@/lib/domain";

export function colorFor(key: PartnerColorKey, theme: "light" | "dark"): string {
  return PARTNER_COLORS[key][theme];
}

export default function PartnerDot({ color, label, size = 28 }: { color: PartnerColorKey; label: string; size?: number }) {
  const theme = useResolvedTheme();
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-heading text-white text-xs"
      role="img"
      style={{ width: size, height: size, background: colorFor(color, theme) }}
    >
      {initial}
    </span>
  );
}
```

`src/components/color-picker.tsx`:

```tsx
import { Check } from "lucide-react";
import { type MouseEvent, useCallback } from "react";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { isPartnerColorKey, PARTNER_COLORS, type PartnerColorKey, partnerColorKeys } from "@/lib/domain";

export default function ColorPicker({
  value,
  onChange,
  taken = [],
}: {
  value: PartnerColorKey;
  onChange: (key: PartnerColorKey) => void;
  taken?: PartnerColorKey[];
}) {
  const theme = useResolvedTheme();
  const onPick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const key = event.currentTarget.dataset.color;
      if (key && isPartnerColorKey(key)) {
        onChange(key);
      }
    },
    [onChange]
  );
  return (
    <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Your colour</legend>
      {partnerColorKeys.map((key) => {
        const selected = value === key;
        const disabled = taken.includes(key) && !selected;
        return (
          <button
            aria-label={key}
            aria-pressed={selected}
            className="flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 aria-pressed:scale-110 aria-pressed:ring-2 aria-pressed:ring-ring"
            data-color={key}
            disabled={disabled}
            key={key}
            onClick={onPick}
            style={{ background: PARTNER_COLORS[key][theme] }}
            type="button"
          >
            {selected ? <Check className="size-4 text-white" /> : null}
          </button>
        );
      })}
    </fieldset>
  );
}
```

- [ ] **Step 4: Login page**

`src/pages/login.tsx`:

```tsx
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PASSWORD_MIN = 6;

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onEmail = useCallback((e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value), []);
  const onPassword = useCallback((e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value), []);
  const toggleMode = useCallback(() => {
    setMode((m) => (m === "in" ? "up" : "in"));
    setError(null);
  }, []);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
        if (mode === "in") {
          await signIn(email.trim(), password);
        } else {
          await signUp(email.trim(), password);
        }
        // /pair forwards fully paired couples to the Den.
        navigate("/pair", { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [mode, email, password, signIn, signUp, navigate]
  );

  return (
    <section className="page-wrap flex min-h-[70dvh] items-center justify-center py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="island-kicker mb-2">Welcome</p>
          <h1 className="display-title text-3xl">{mode === "in" ? "Sign in to your den" : "Make your account"}</h1>
          <p className="text-muted-foreground text-sm">
            {mode === "in" ? "Your pup has been waiting." : "One account each; you'll pair up next."}
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input autoComplete="email" id="email" inputMode="email" onChange={onEmail} required type="email" value={email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                id="password"
                minLength={PASSWORD_MIN}
                onChange={onPassword}
                required
                type="password"
                value={password}
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" disabled={busy} type="submit">
              {mode === "in" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <Button className="mt-3 w-full" onClick={toggleMode} type="button" variant="ghost">
            {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 5: Den context, guards and routes**

`src/data/den-context.tsx`:

```tsx
import { createContext, useContext } from "react";
import type { Me } from "@/data/queries";
import type { Couple } from "@/lib/domain";

export type DenMe = Me & { couple: Couple };

export interface DenValue {
  me: DenMe;
  refresh: () => Promise<Me | undefined>;
}

export const DenContext = createContext<DenValue | null>(null);

export function useDen(): DenValue {
  const value = useContext(DenContext);
  if (!value) {
    throw new Error("useDen must be used under RequireDen.");
  }
  return value;
}
```

Replace `src/routes.tsx`:

```tsx
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/auth/auth-provider";
import AppShell from "@/components/app-shell";
import RouteErrorPanel, { ErrorPanel } from "@/components/error-panel";
import { DenContext, type DenValue } from "@/data/den-context";
import { useMe } from "@/data/use-me";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";

function Loading() {
  return (
    <section className="page-wrap py-16">
      <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-muted" />
    </section>
  );
}

/** Signed-in users only. */
function RequireSession() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") {
    return <Loading />;
  }
  if (status === "signed-out") {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }
  return <Outlet />;
}

/** Signed-in users with a den. Provides `me` (with a non-null couple) to pages. */
function RequireDen() {
  const { me, error, isLoading, refresh } = useMe();
  if (error) {
    return <ErrorPanel error={error} />;
  }
  if (isLoading || !me) {
    return <Loading />;
  }
  if (!me.couple) {
    return <Navigate replace to="/pair" />;
  }
  const value: DenValue = { me: { ...me, couple: me.couple }, refresh };
  return (
    <DenContext.Provider value={value}>
      <Outlet />
    </DenContext.Provider>
  );
}

/** Landing and login: a signed-in visitor goes straight to their den (or to pairing). */
function SignedOutOnly() {
  const { status } = useAuth();
  const { me, isLoading } = useMe();
  if (status === "loading" || (status === "signed-in" && (isLoading || !me))) {
    return <Loading />;
  }
  if (status === "signed-in" && me) {
    return <Navigate replace to={me.couple ? "/den" : "/pair"} />;
  }
  return <Outlet />;
}

function Placeholder({ title }: { title: string }) {
  return (
    <section className="page-wrap py-10">
      <h1 className="display-title text-3xl">{title}</h1>
    </section>
  );
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPanel />,
    children: [
      {
        element: <AppShell showNav={false} />,
        children: [
          {
            element: <SignedOutOnly />,
            children: [
              { path: "/", element: <LandingPage /> },
              { path: "/login", element: <LoginPage /> },
            ],
          },
          {
            element: <RequireSession />,
            children: [{ path: "/pair", element: <Placeholder title="Pair" /> }],
          },
        ],
      },
      {
        element: <AppShell />,
        children: [
          {
            element: <RequireSession />,
            children: [
              {
                element: <RequireDen />,
                children: [
                  { path: "/den", element: <Placeholder title="Den" /> },
                  { path: "/goals", element: <Placeholder title="Timeline" /> },
                  { path: "/us", element: <Placeholder title="Us" /> },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <Navigate replace to="/" /> },
    ],
  },
]);
```

In `src/main.tsx` wrap the router: `<AuthProvider><RouterProvider router={router} /></AuthProvider>` (import from `@/auth/auth-provider`). In `src/components/app-shell.tsx` add a sign-out button next to the theme toggle when signed in:

```tsx
import { LogOut } from "lucide-react";
import { useCallback } from "react";
import { useAuth } from "@/auth/auth-provider";
import { Button } from "@/components/ui/button";

function SignOutButton() {
  const { status, signOut } = useAuth();
  const onClick = useCallback(() => {
    void signOut();
  }, [signOut]);
  if (status !== "signed-in") {
    return null;
  }
  return (
    <Button aria-label="Sign out" onClick={onClick} size="icon" type="button" variant="ghost">
      <LogOut className="size-5" />
    </Button>
  );
}
```

and render `<SignOutButton />` before `{right}` inside the header's right-hand group.

- [ ] **Step 6: Verify**

`npm run fix && npm run check && npm test`, then in the browser (`npm run dev`): `/login` → "Create account" with `dev-a@example.com` and a throwaway password (pick one; never commit it) → lands on `/pair` placeholder. Reload → still signed in. Sign out → `/login`. Visit `/den` signed out → `/login`. Mobile sweep at 320/375/768/1280 on `/login`: inputs at 16px, no sideways scroll, the card fits at 320.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "Add Supabase auth, who-am-I, route guards and the login page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Pairing mutations, the `/pair` page, the Us page

**Files:**
- Create: `src/data/mutations.ts` (pairing half; Task 6 adds goals and check-ins), `src/pages/pair.tsx`, `src/pages/us.tsx`
- Modify: `src/routes.tsx` (real pages for `/pair` and `/us`)

**Interfaces:**
- Produces (`mutations.ts`): `createDen(displayName, color) → { coupleId, inviteCode }`, `joinDen(code, displayName, color) → coupleId`, `mintInviteCode() → string`, `updateCouple(coupleId, { pupName?, anniversary? })`, `updateMember(userId, { displayName?, color? })`. Every function throws `Error` whose message is ready to show.
- Consumes: `useAuth`, `useMe`, `useDen`, `ColorPicker`, `PartnerDot`, `normalizeShareCode`, `isValidShareCode`, `daysBetween`, `localDayKey`.

- [ ] **Step 1: Pairing mutations**

`src/data/mutations.ts`:

```ts
import { friendlyError } from "@/lib/errors";
import type { PartnerColorKey } from "@/lib/domain";
import { normalizeShareCode } from "@/lib/share-code";
import { supabase } from "@/lib/supabase";

function wrap(error: unknown): Error {
  return new Error(friendlyError(error), { cause: error });
}

export async function createDen(displayName: string, color: PartnerColorKey): Promise<{ coupleId: string; inviteCode: string }> {
  const { data, error } = await supabase.rpc("create_den", { p_display_name: displayName.trim(), p_color: color });
  if (error) {
    throw wrap(error);
  }
  const row = data[0];
  if (!row) {
    throw new Error("Could not create the den. Try again?");
  }
  return { coupleId: row.couple_id, inviteCode: row.invite_code };
}

export async function joinDen(code: string, displayName: string, color: PartnerColorKey): Promise<string> {
  const { data, error } = await supabase.rpc("join_den", {
    p_code: normalizeShareCode(code),
    p_display_name: displayName.trim(),
    p_color: color,
  });
  if (error) {
    throw wrap(error);
  }
  return data;
}

export async function mintInviteCode(): Promise<string> {
  const { data, error } = await supabase.rpc("mint_invite_code");
  if (error) {
    throw wrap(error);
  }
  return data;
}

export async function updateCouple(coupleId: string, patch: { pupName?: string; anniversary?: string | null }): Promise<void> {
  const row: { pup_name?: string; anniversary?: string | null } = {};
  if (patch.pupName !== undefined) {
    row.pup_name = patch.pupName.trim();
  }
  if (patch.anniversary !== undefined) {
    row.anniversary = patch.anniversary;
  }
  const { error } = await supabase.from("couples").update(row).eq("id", coupleId);
  if (error) {
    throw wrap(error);
  }
}

export async function updateMember(userId: string, patch: { displayName?: string; color?: PartnerColorKey }): Promise<void> {
  const row: { display_name?: string; color?: string } = {};
  if (patch.displayName !== undefined) {
    row.display_name = patch.displayName.trim();
  }
  if (patch.color !== undefined) {
    row.color = patch.color;
  }
  const { error } = await supabase.from("members").update(row).eq("user_id", userId);
  if (error) {
    throw wrap(error);
  }
}
```

- [ ] **Step 2: The Pair page**

`src/pages/pair.tsx`:

```tsx
import { Copy, Heart } from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "@/auth/auth-provider";
import ColorPicker from "@/components/color-picker";
import { ErrorPanel } from "@/components/error-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDen, joinDen, updateCouple } from "@/data/mutations";
import type { Me } from "@/data/queries";
import { useMe } from "@/data/use-me";
import { DEFAULT_COLOR_A, DISPLAY_NAME_MAX, MAX_MEMBERS, type PartnerColorKey, PUP_NAME_MAX } from "@/lib/domain";
import { isValidShareCode, normalizeShareCode } from "@/lib/share-code";

type Step = "choose" | "waiting" | "name";

function initialStepFor(me: Me): Step {
  if (!me.couple) {
    return "choose";
  }
  return me.members.length === MAX_MEMBERS ? "name" : "waiting";
}

export default function PairPage() {
  const { email } = useAuth();
  const { me, error: loadError, isLoading, refresh } = useMe();
  if (loadError) {
    return <ErrorPanel error={loadError} />;
  }
  if (isLoading || !me) {
    return null;
  }
  // Fully paired and the pup is named: nothing left to do here.
  if (me.couple && me.members.length === MAX_MEMBERS && me.couple.pupName) {
    return <Navigate replace to="/den" />;
  }
  return <PairFlow email={email} me={me} refresh={refresh} />;
}

function PairFlow({ email, me, refresh }: { email: string | null; me: Me; refresh: () => Promise<Me | undefined> }) {
  const navigate = useNavigate();
  const self = me.members.find((m) => m.id === me.userId);
  const defaultName = self?.displayName ?? email?.split("@")[0] ?? "";
  const [displayName, setDisplayName] = useState(defaultName);
  const [color, setColor] = useState<PartnerColorKey>(DEFAULT_COLOR_A);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>(() => initialStepFor(me));
  const [inviteCode, setInviteCode] = useState(me.couple?.inviteCode ?? "");
  const [pupName, setPupName] = useState("");

  // The partner joining flips this page from "waiting" to "name" (Realtime is wired in Task 6;
  // until then SWR's focus revalidation catches it).
  useEffect(() => {
    if (step === "waiting" && me.members.length === MAX_MEMBERS) {
      setStep("name");
    }
  }, [step, me.members.length]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onCreate = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      run(async () => {
        const den = await createDen(displayName, color);
        setInviteCode(den.inviteCode);
        await refresh();
        setStep("waiting");
      });
    },
    [run, displayName, color, refresh]
  );

  const onJoin = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      run(async () => {
        if (!isValidShareCode(normalizeShareCode(code))) {
          throw new Error("A share code is 6 letters or digits, like ABC234.");
        }
        await joinDen(code, displayName, color);
        await refresh();
        setStep("name");
      });
    },
    [run, code, displayName, color, refresh]
  );

  const onName = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      run(async () => {
        if (!me.couple) {
          throw new Error("You are not in a den yet.");
        }
        await updateCouple(me.couple.id, { pupName });
        await refresh();
        navigate("/den", { replace: true });
      });
    },
    [run, pupName, me.couple, refresh, navigate]
  );

  const onDisplayName = useCallback((e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value), []);
  const onCode = useCallback((e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value), []);
  const onPupName = useCallback((e: ChangeEvent<HTMLInputElement>) => setPupName(e.target.value), []);
  const copyCode = useCallback(() => {
    void navigator.clipboard.writeText(inviteCode);
  }, [inviteCode]);
  const goToDen = useCallback(() => navigate("/den"), [navigate]);

  if (step === "name") {
    return (
      <section className="page-wrap flex min-h-[60dvh] items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <p className="island-kicker mb-2">You're paired</p>
            <h1 className="display-title text-3xl">Name your pup</h1>
            <p className="text-muted-foreground text-sm">A bulldog puppy just moved into your den. What do we call them?</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onName}>
              <div className="space-y-2">
                <Label htmlFor="pup-name">Pup name</Label>
                <Input autoComplete="off" id="pup-name" maxLength={PUP_NAME_MAX} onChange={onPupName} placeholder="Mochi" required value={pupName} />
              </div>
              {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
              <Button className="w-full" disabled={busy || pupName.trim().length === 0} type="submit">
                Adopt {pupName.trim() || "them"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (step === "waiting") {
    return (
      <section className="page-wrap flex min-h-[60dvh] items-center justify-center py-10">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <p className="island-kicker mb-2">Your den is ready</p>
            <h1 className="display-title text-3xl">Share this code</h1>
            <p className="text-muted-foreground text-sm">Your partner enters it on their Pair page and you're in the same den.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-heading text-4xl tracking-[0.3em] sm:text-5xl">{inviteCode}</p>
            <Button onClick={copyCode} type="button" variant="outline">
              <Copy /> Copy code
            </Button>
            <p className="text-muted-foreground text-xs">You can start adding goals now.</p>
            <Button onClick={goToDen} type="button" variant="ghost">
              Go to the Den
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-wrap py-10">
      <div className="mb-8 max-w-2xl">
        <p className="island-kicker mb-2">Two people, one den</p>
        <h1 className="display-title text-4xl">Let's pair up</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="display-title text-2xl">
              <Heart className="mr-2 inline size-5 text-primary" />
              Start our den
            </h2>
            <p className="text-muted-foreground text-sm">You get a share code for your partner.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onCreate}>
              <div className="space-y-2">
                <Label htmlFor="name-create">Your name</Label>
                <Input autoComplete="given-name" id="name-create" maxLength={DISPLAY_NAME_MAX} onChange={onDisplayName} required value={displayName} />
              </div>
              <div className="space-y-2">
                <Label>Your colour</Label>
                <ColorPicker onChange={setColor} value={color} />
              </div>
              <Button className="w-full sm:w-auto" disabled={busy} type="submit">
                Create den
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="display-title text-2xl">Join with a code</h2>
            <p className="text-muted-foreground text-sm">Got a 6-character code from your partner? If you pick the same colour as them, you'll get another.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onJoin}>
              <div className="space-y-2">
                <Label htmlFor="name-join">Your name</Label>
                <Input autoComplete="given-name" id="name-join" maxLength={DISPLAY_NAME_MAX} onChange={onDisplayName} required value={displayName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Share code</Label>
                <Input
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="font-heading text-xl uppercase tracking-[0.3em]"
                  id="code"
                  maxLength={7}
                  onChange={onCode}
                  placeholder="ABC234"
                  required
                  value={code}
                />
              </div>
              <div className="space-y-2">
                <Label>Your colour</Label>
                <ColorPicker onChange={setColor} value={color} />
              </div>
              <Button className="w-full sm:w-auto" disabled={busy} type="submit" variant="secondary">
                Join den
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      {error ? (
        <p className="mt-4 text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 3: The Us page**

`src/pages/us.tsx`:

```tsx
import { Copy } from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import ColorPicker from "@/components/color-picker";
import PartnerDot from "@/components/partner-dot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mintInviteCode, updateCouple, updateMember } from "@/data/mutations";
import { localDayKey } from "@/lib/day";
import { DISPLAY_NAME_MAX, MAX_MEMBERS, type PartnerColorKey, PUP_NAME_MAX } from "@/lib/domain";
import { daysBetween } from "@/lib/periods";
import { useDen } from "@/data/den-context";

export default function UsPage() {
  const { me, refresh } = useDen();
  const { couple } = me;
  const self = me.members.find((m) => m.id === me.userId);
  const [pupName, setPupName] = useState(couple.pupName ?? "");
  const [displayName, setDisplayName] = useState(self?.displayName ?? "");
  const [anniversary, setAnniversary] = useState(couple.anniversary ?? "");
  const [busy, setBusy] = useState(false);

  const save = useCallback(
    async (work: () => Promise<void>, done: string) => {
      setBusy(true);
      try {
        await work();
        await refresh();
        toast(done);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save.");
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void save(async () => {
        await updateCouple(couple.id, { pupName, anniversary: anniversary || null });
        await updateMember(me.userId, { displayName });
      }, "Saved");
    },
    [save, couple.id, pupName, anniversary, me.userId, displayName]
  );
  const onColor = useCallback(
    (key: PartnerColorKey) => {
      void save(() => updateMember(me.userId, { color: key }), "Colour updated");
    },
    [save, me.userId]
  );
  const onPupName = useCallback((e: ChangeEvent<HTMLInputElement>) => setPupName(e.target.value), []);
  const onDisplayName = useCallback((e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value), []);
  const onAnniversary = useCallback((e: ChangeEvent<HTMLInputElement>) => setAnniversary(e.target.value), []);
  const copyCode = useCallback(() => {
    void navigator.clipboard.writeText(couple.inviteCode ?? "");
    toast("Code copied");
  }, [couple.inviteCode]);
  const mintCode = useCallback(() => {
    void save(async () => {
      await mintInviteCode();
    }, "New code minted");
  }, [save]);

  if (!self) {
    return null;
  }

  const daysOfUs = couple.anniversary ? daysBetween(couple.anniversary, localDayKey()) : null;
  const taken = me.members.filter((m) => m.id !== self.id).map((m) => m.color);

  return (
    <section className="page-wrap space-y-6 py-8 sm:py-10">
      <div>
        <p className="island-kicker mb-2">Us</p>
        <h1 className="display-title text-3xl sm:text-4xl">{me.members.map((m) => m.displayName).join(" & ")}</h1>
        {daysOfUs !== null ? <p className="text-muted-foreground">{daysOfUs} days of us</p> : null}
      </div>

      <Card>
        <CardHeader>
          <h2 className="display-title text-2xl">Our den</h2>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="pup">Pup name</Label>
              <Input id="pup" maxLength={PUP_NAME_MAX} onChange={onPupName} value={pupName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="me">Your name</Label>
              <Input id="me" maxLength={DISPLAY_NAME_MAX} onChange={onDisplayName} value={displayName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anniversary">Anniversary</Label>
              <Input id="anniversary" onChange={onAnniversary} type="date" value={anniversary} />
            </div>
            <div className="flex items-end">
              <Button className="w-full sm:w-auto" disabled={busy} type="submit">
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="display-title text-2xl">Colours</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {me.members.map((m) => (
              <span className="flex items-center gap-2 text-sm" key={m.id}>
                <PartnerDot color={m.color} label={m.displayName} /> {m.displayName}
              </span>
            ))}
          </div>
          <ColorPicker onChange={onColor} taken={taken} value={self.color} />
        </CardContent>
      </Card>

      {me.members.length < MAX_MEMBERS ? (
        <Card>
          <CardHeader>
            <h2 className="display-title text-2xl">Waiting for your partner</h2>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="font-heading text-3xl tracking-[0.3em]">{couple.inviteCode ?? "······"}</span>
            <Button onClick={copyCode} type="button" variant="outline">
              <Copy /> Copy
            </Button>
            <Button disabled={busy} onClick={mintCode} type="button" variant="ghost">
              Mint a new code
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="display-title text-2xl">About our pup</h2>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground text-sm">
          <p>
            "Bulldog Puppy" by{" "}
            <a className="underline" href="https://sketchfab.com/3d-models/bulldog-puppy-7081c9c27df244bf84774361888f58a2" rel="noopener noreferrer" target="_blank">
              doinspire
            </a>
            , licensed under{" "}
            <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer" target="_blank">
              CC BY 4.0
            </a>
            .
          </p>
          <p>
            Skeleton and animations from the Ultimate Animated Animal Pack by{" "}
            <a className="underline" href="https://quaternius.com" rel="noopener noreferrer" target="_blank">
              Quaternius
            </a>{" "}
            (CC0). Thank you.
          </p>
          <p>Leaving a den isn't built yet. If you need it, tell us.</p>
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 4: Wire the routes**

In `src/routes.tsx` import `PairPage` and `UsPage` and replace the two placeholders (`/pair` → `<PairPage />`, `/us` → `<UsPage />`).

- [ ] **Step 5: Verify with two users**

`npm run fix && npm run check && npm test`. Browser A (dev-a): `/pair` → Create den → code shown. Browser B (a second Playwright context, sign up `dev-b@example.com`): Join with the code → "Name your pup" → adopt "Mochi" → `/den` placeholder. Browser A: refocus the tab → the page moves to "Name your pup" (already named by B → `/pair` redirects to `/den`). `/us` on both: rename pup, change colour (the partner's colour is disabled), set anniversary, "N days of us" appears. Try joining a used code from a third account → the inline "That code isn't waiting for anyone" message. Mobile sweep on `/pair` and `/us` (cards stack at 320, colour swatches wrap, date input at 16px).

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "Add pairing with share codes and the Us page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Stage 3: The daily ritual

### Task 6: Couple data: one fetch, pure views, Realtime, mutations, habit toggle

**Files:**
- Modify: `src/data/queries.ts` (add `fetchCoupleData`), `src/data/mutations.ts` (add goals and check-ins)
- Create: `src/lib/views.ts`, `src/lib/views.test.ts`, `src/data/use-couple-data.ts`, `src/hooks/use-habit-toggle.ts`

**Interfaces:**
- Produces (`queries.ts`): `fetchCoupleData(coupleId: string, fromDay: string): Promise<CoupleData>`.
- Produces (`views.ts`): `DenData = { habits: Goal[]; habitStates: Record<string, HabitState>; ticker: TickerItem[]; waitingForMySeal: Goal[]; lastCheckInAt: string | null; todayCount: number; members: Member[]; me: string; today: string; pupName: string | null }`; `TimelineData = { goals: Goal[]; checkins: CheckInLite[]; progress: Record<string, GoalProgress>; habits: Record<string, HabitState>; members: Member[]; me: string; today: string }`; `denView(data, me, today)`, `timelineView(data, me, today)`, `toLite(checkins)`.
- Produces (`use-couple-data.ts`): `useCoupleData(coupleId, today): { data: CoupleData | undefined; error: unknown; refresh(): Promise<CoupleData | undefined> }`; keeps the SWR cache fresh from Realtime and also revalidates the `["me", userId]` key on `couples`/`members` events.
- Produces (`mutations.ts`): `createGoal({ coupleId, uid, input: GoalInput, today }) → Goal`, `updateGoal(goalId, { title?, charm?, targetUnits?, parentGoalId? })`, `archiveGoal(goalId)`, `sealGoal(goalId, uid, coupleId)`, `stamp({ coupleId, goalId, uid, day }) → { created: boolean }` (a duplicate habit paw is `created: false`, no error), `unstampHabit({ goalId, uid, day })`, `undoLastMilestonePaw(checkinId)`, `sendHeart({ checkinId, uid, coupleId })`.
- Produces (`use-habit-toggle.ts`): `HabitToggle = { toggle(goal, current): Promise<void>; view(goalId, state): HabitState | undefined; busy: Set<string> }`, `useHabitToggle(ctx: { coupleId; me; refresh }, onStamped?)`.

- [ ] **Step 1: `fetchCoupleData`**

Append to `src/data/queries.ts`:

```ts
import type { CoupleData } from "@/lib/domain";
import { checkinFromRow, goalFromRow } from "./mappers";

/** Everything a den needs, from 1 January of the viewed year. Six small queries, in parallel. */
export async function fetchCoupleData(coupleId: string, fromDay: string): Promise<CoupleData> {
  const [couple, members, goals, seals, checkins, reactions] = await Promise.all([
    supabase.from("couples").select("*").eq("id", coupleId).single(),
    supabase.from("members").select("*").eq("couple_id", coupleId).order("joined_at"),
    supabase.from("goals").select("*").eq("couple_id", coupleId).order("created_at"),
    supabase.from("goal_seals").select("*").eq("couple_id", coupleId),
    supabase
      .from("checkins")
      .select("*")
      .eq("couple_id", coupleId)
      .gte("day", fromDay)
      .order("at", { ascending: false })
      .order("id", { ascending: false }),
    supabase.from("reactions").select("*").eq("couple_id", coupleId),
  ]);
  for (const result of [couple, members, goals, seals, checkins, reactions]) {
    if (result.error) {
      throw result.error;
    }
  }
  if (!couple.data) {
    throw new Error("This den is gone.");
  }
  const sealRows = seals.data ?? [];
  const reactionRows = reactions.data ?? [];
  return {
    couple: coupleFromRow(couple.data),
    members: (members.data ?? []).map(memberFromRow),
    goals: (goals.data ?? []).map((g) => goalFromRow(g, sealRows)),
    checkins: (checkins.data ?? []).map((c) => checkinFromRow(c, reactionRows)),
  };
}
```

(merge the two import blocks at the top of the file into one).

- [ ] **Step 2: View tests, then `views.ts`**

`src/lib/views.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { CheckIn, CoupleData, Goal } from "./domain";
import { denView, timelineView } from "./views";

const A = "a";
const B = "b";

function goal(partial: Partial<Goal> & Pick<Goal, "id" | "horizon">): Goal {
  return {
    coupleId: "c1", title: partial.id, charm: null, owner: A, period: null, targetUnits: null,
    parentGoalId: null, seals: {}, createdBy: A, createdAt: "2026-09-01T00:00:00.000Z", archivedAt: null,
    ...partial,
  };
}

function checkin(id: string, goalId: string, uid: string, day: string, at: string, reactions: Record<string, "heart"> = {}): CheckIn {
  return { id, coupleId: "c1", goalId, uid, day, at, horizon: "day", reactions };
}

const data: CoupleData = {
  couple: { id: "c1", pupName: "Mochi", anniversary: null, inviteCode: null, createdBy: A, createdAt: "2026-09-01T00:00:00.000Z" },
  members: [
    { id: A, displayName: "Ann", color: "rose" },
    { id: B, displayName: "Bo", color: "teal" },
  ],
  goals: [
    goal({ id: "walk", horizon: "day", owner: "shared" }),
    goal({ id: "old", horizon: "day", archivedAt: "2026-09-02T00:00:00.000Z" }),
    goal({ id: "m", horizon: "month", period: "2026-09", targetUnits: 2, owner: "shared", seals: { [A]: "2026-09-01T00:00:00.000Z" } }),
  ],
  checkins: [
    checkin("3", "walk", B, "2026-09-17", "2026-09-17T09:00:00.000Z"),
    checkin("2", "walk", A, "2026-09-17", "2026-09-17T08:00:00.000Z", { [B]: "heart" }),
    checkin("1", "walk", A, "2026-09-16", "2026-09-16T08:00:00.000Z"),
  ],
};

describe("denView", () => {
  test("shapes habits, states, ticker, seals, counts", () => {
    const den = denView(data, B, "2026-09-17");
    expect(den.habits.map((g) => g.id)).toEqual(["walk"]);
    expect(den.habitStates.walk?.todayBy).toEqual({ [A]: true, [B]: true });
    expect(den.ticker.map((t) => t.checkinId)).toEqual(["3", "2", "1"]);
    expect(den.ticker[1]?.goalTitle).toBe("walk");
    expect(den.ticker[1]?.reactions).toEqual({ [B]: "heart" });
    expect(den.waitingForMySeal.map((g) => g.id)).toEqual(["m"]);
    expect(den.lastCheckInAt).toBe("2026-09-17T09:00:00.000Z");
    expect(den.todayCount).toBe(2);
    expect(den.pupName).toBe("Mochi");
    expect(den.me).toBe(B);
  });

  test("a creator has nothing waiting for their seal", () => {
    expect(denView(data, A, "2026-09-17").waitingForMySeal).toEqual([]);
  });
});

describe("timelineView", () => {
  test("carries active goals, lite checkins, progress and habit states", () => {
    const tl = timelineView(data, A, "2026-09-17");
    expect(tl.goals.map((g) => g.id)).toEqual(["walk", "m"]);
    expect(tl.checkins).toHaveLength(3);
    expect(tl.progress.m?.target).toBe(2);
    expect(tl.habits.walk?.streakDays).toBe(2);
  });
});
```

Run `npm test -- views`: FAIL. Then `src/lib/views.ts`:

```ts
// Turns one CoupleData fetch into what the Den and the Timeline render. Pure.
import { type CoupleData, type Goal, type Member, SHARED_OWNER, TICKER_LIMIT, type TickerItem } from "./domain";
import { type CheckInLite, computeHabitStates, computeProgress, type GoalProgress, type HabitState } from "./ladder";

export interface DenData {
  habits: Goal[];
  habitStates: Record<string, HabitState>;
  ticker: TickerItem[];
  /** Shared goals the viewer has not pressed their wax on yet. */
  waitingForMySeal: Goal[];
  lastCheckInAt: string | null;
  todayCount: number;
  members: Member[];
  me: string;
  today: string;
  pupName: string | null;
}

export interface TimelineData {
  goals: Goal[];
  checkins: CheckInLite[];
  progress: Record<string, GoalProgress>;
  habits: Record<string, HabitState>;
  members: Member[];
  me: string;
  today: string;
}

export function toLite(data: CoupleData): CheckInLite[] {
  return data.checkins.map((c) => ({ goalId: c.goalId, uid: c.uid, day: c.day }));
}

export function activeGoals(data: CoupleData): Goal[] {
  return data.goals.filter((g) => g.archivedAt === null);
}

export function denView(data: CoupleData, me: string, today: string): DenData {
  const goals = activeGoals(data);
  const habits = goals.filter((g) => g.horizon === "day");
  const lite = toLite(data);
  const byId = new Map(data.goals.map((g) => [g.id, g]));
  const ticker: TickerItem[] = data.checkins.slice(0, TICKER_LIMIT).map((c) => ({
    checkinId: c.id,
    uid: c.uid,
    goalId: c.goalId,
    goalTitle: byId.get(c.goalId)?.title ?? "a goal",
    charm: byId.get(c.goalId)?.charm ?? null,
    at: c.at,
    reactions: c.reactions,
  }));
  return {
    habits,
    habitStates: computeHabitStates(habits, lite, today, data.members.map((m) => m.id)),
    ticker,
    waitingForMySeal: goals.filter((g) => g.owner === SHARED_OWNER && !g.seals[me]),
    lastCheckInAt: data.checkins[0]?.at ?? null,
    todayCount: data.checkins.filter((c) => c.day === today).length,
    members: data.members,
    me,
    today,
    pupName: data.couple.pupName,
  };
}

export function timelineView(data: CoupleData, me: string, today: string): TimelineData {
  const goals = activeGoals(data);
  const lite = toLite(data);
  return {
    goals,
    checkins: lite,
    progress: computeProgress(goals, lite, today),
    habits: computeHabitStates(goals, lite, today, data.members.map((m) => m.id)),
    members: data.members,
    me,
    today,
  };
}
```

Run `npm test -- views`: pass.

- [ ] **Step 3: The live data hook**

`src/data/use-couple-data.ts`:

```ts
import { useEffect, useRef } from "react";
import useSWR, { mutate as mutateGlobal } from "swr";
import { useAuth } from "@/auth/auth-provider";
import type { CoupleData } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { fetchCoupleData } from "./queries";

const FALLBACK_REFRESH_MS = 60_000;
const SETTLE_MS = 150;

const LIVE_TABLES = [
  { table: "couples", column: "id", me: true },
  { table: "members", column: "couple_id", me: true },
  { table: "goals", column: "couple_id", me: false },
  { table: "goal_seals", column: "couple_id", me: false },
  { table: "checkins", column: "couple_id", me: false },
  { table: "reactions", column: "couple_id", me: false },
] as const;

/**
 * One SWR entry per couple and year, kept fresh three ways: Realtime rows for
 * this couple, focus/visibility revalidation (an iPhone PWA coming back from
 * the background), and a slow interval as the safety net.
 */
export function useCoupleData(coupleId: string, today: string) {
  const { userId } = useAuth();
  const year = today.slice(0, 4);
  const swr = useSWR<CoupleData>(["couple", coupleId, year], () => fetchCoupleData(coupleId, `${year}-01-01`), {
    refreshInterval: FALLBACK_REFRESH_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  const { mutate } = swr;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const channel = supabase.channel(`couple:${coupleId}`);
    for (const live of LIVE_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: live.table, filter: `${live.column}=eq.${coupleId}` },
        () => {
          // Bursts (a stamp plus its reaction) collapse into one refetch.
          if (timer.current !== null) {
            window.clearTimeout(timer.current);
          }
          timer.current = window.setTimeout(() => {
            timer.current = null;
            void mutate();
            if (live.me && userId) {
              void mutateGlobal(["me", userId]);
            }
          }, SETTLE_MS);
        }
      );
    }
    channel.subscribe();
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [coupleId, mutate, userId]);

  return { data: swr.data, error: swr.error, refresh: mutate };
}
```

- [ ] **Step 4: Goal and check-in mutations**

Append to `src/data/mutations.ts`:

```ts
import { isDuplicate } from "@/lib/errors";
import type { Goal, GoalInput } from "@/lib/domain";
import { SHARED_OWNER } from "@/lib/domain";
import { periodFor } from "@/lib/periods";
import { goalFromRow } from "./mappers";

export async function createGoal(args: { coupleId: string; uid: string; input: GoalInput; today: string }): Promise<Goal> {
  const { coupleId, uid, input, today } = args;
  const milestone = input.horizon !== "day";
  const { data, error } = await supabase
    .from("goals")
    .insert({
      couple_id: coupleId,
      title: input.title.trim(),
      charm: input.charm?.trim() || null,
      horizon: input.horizon,
      owner_id: input.owner === SHARED_OWNER ? null : input.owner,
      period: milestone ? periodFor(input.horizon, today) : null,
      target_units: milestone ? input.targetUnits : null,
      parent_goal_id: input.parentGoalId,
      created_by: uid,
    })
    .select("*")
    .single();
  if (error) {
    throw wrap(error);
  }
  // The creator's seal is added by a trigger; reflect it locally.
  const seals = input.owner === SHARED_OWNER ? [{ goal_id: data.id, user_id: uid, couple_id: coupleId, sealed_at: new Date().toISOString() }] : [];
  return goalFromRow(data, seals);
}

export async function updateGoal(
  goalId: string,
  patch: { title?: string; charm?: string | null; targetUnits?: number; parentGoalId?: string | null }
): Promise<void> {
  const row: { title?: string; charm?: string | null; target_units?: number; parent_goal_id?: string | null } = {};
  if (patch.title !== undefined) {
    row.title = patch.title.trim();
  }
  if (patch.charm !== undefined) {
    row.charm = patch.charm?.trim() || null;
  }
  if (patch.targetUnits !== undefined) {
    row.target_units = patch.targetUnits;
  }
  if (patch.parentGoalId !== undefined) {
    row.parent_goal_id = patch.parentGoalId;
  }
  const { error } = await supabase.from("goals").update(row).eq("id", goalId);
  if (error) {
    throw wrap(error);
  }
}

export async function archiveGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from("goals").update({ archived_at: new Date().toISOString() }).eq("id", goalId);
  if (error) {
    throw wrap(error);
  }
}

/** Press your wax on a shared goal. Pressing twice is a no-op. */
export async function sealGoal(goalId: string, uid: string, coupleId: string): Promise<void> {
  const { error } = await supabase.from("goal_seals").insert({ goal_id: goalId, user_id: uid, couple_id: coupleId });
  if (error && !isDuplicate(error)) {
    throw wrap(error);
  }
}

/** Stamp a paw. A second habit paw on the same day is reported, not thrown. */
export async function stamp(args: { coupleId: string; goalId: string; uid: string; day: string }): Promise<{ created: boolean }> {
  const { error } = await supabase
    .from("checkins")
    .insert({ couple_id: args.coupleId, goal_id: args.goalId, user_id: args.uid, day: args.day, horizon: "day" });
  if (error) {
    if (isDuplicate(error)) {
      return { created: false };
    }
    throw wrap(error);
  }
  return { created: true };
}

export async function unstampHabit(args: { goalId: string; uid: string; day: string }): Promise<void> {
  const { error } = await supabase.from("checkins").delete().eq("goal_id", args.goalId).eq("user_id", args.uid).eq("day", args.day);
  if (error) {
    throw wrap(error);
  }
}

export async function undoLastMilestonePaw(checkinId: string): Promise<void> {
  const { error } = await supabase.from("checkins").delete().eq("id", checkinId);
  if (error) {
    throw wrap(error);
  }
}

export async function sendHeart(args: { checkinId: string; uid: string; coupleId: string }): Promise<void> {
  const { error } = await supabase
    .from("reactions")
    .insert({ checkin_id: args.checkinId, user_id: args.uid, couple_id: args.coupleId });
  if (error && !isDuplicate(error)) {
    throw wrap(error);
  }
}
```

`couple_id` on seal and reaction inserts, and `horizon` on stamps, are set from what the client knows; the `before insert` triggers overwrite them from the goal/check-in anyway, and the RLS `with check` sees the trigger's values.

- [ ] **Step 5: The habit toggle hook**

`src/hooks/use-habit-toggle.ts`:

```ts
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { stamp, unstampHabit } from "@/data/mutations";
import { localDayKey } from "@/lib/day";
import type { Goal } from "@/lib/domain";
import type { HabitState } from "@/lib/ladder";

export interface HabitToggle {
  /** Stamp or undo today's paw for `goal`; `current` is what the UI shows now. */
  toggle: (goal: Goal, current: boolean) => Promise<void>;
  /** Apply the optimistic override (if any) to a habit's fetched state. */
  view: (goalId: string, state: HabitState | undefined) => HabitState | undefined;
  busy: Set<string>;
}

export function useHabitToggle(
  ctx: { coupleId: string; me: string; refresh: () => Promise<unknown> },
  onStamped?: () => void
): HabitToggle {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Set<string>>(() => new Set());

  const toggle = useCallback(
    async (goal: Goal, current: boolean) => {
      if (busy.has(goal.id)) {
        return;
      }
      setBusy((prev) => new Set(prev).add(goal.id));
      setOverrides((prev) => ({ ...prev, [goal.id]: !current }));
      const day = localDayKey();
      try {
        if (current) {
          await unstampHabit({ goalId: goal.id, uid: ctx.me, day });
        } else {
          const { created } = await stamp({ coupleId: ctx.coupleId, goalId: goal.id, uid: ctx.me, day });
          if (created) {
            onStamped?.();
          }
        }
        await ctx.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That paw didn't land. Try again?");
      } finally {
        setOverrides((prev) => {
          const { [goal.id]: _dropped, ...rest } = prev;
          return rest;
        });
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(goal.id);
          return next;
        });
      }
    },
    [busy, ctx, onStamped]
  );

  const view = useCallback(
    (goalId: string, state: HabitState | undefined): HabitState | undefined => {
      const override = overrides[goalId];
      if (override === undefined || !state) {
        return state;
      }
      return { ...state, todayBy: { ...state.todayBy, [ctx.me]: override } };
    },
    [overrides, ctx.me]
  );

  return { toggle, view, busy };
}
```

- [ ] **Step 6: Check and commit**

```bash
npm run fix && npm run check && npm test
git add src
git commit -m "Add couple data fetch, pure views, Realtime hook and goal mutations

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The Timeline's Day tab: paw row, habit card, horizon tabs, new-goal dialog

**Files:**
- Create: `src/hooks/use-today.ts`, `src/components/goals/paw-row.tsx`, `src/components/goals/habit-card.tsx`, `src/components/goals/horizon-tabs.tsx`, `src/components/goals/new-goal-dialog.tsx`, `src/pages/timeline.tsx`
- Modify: `src/routes.tsx` (`/goals` → `<TimelinePage />`)

**Interfaces:**
- Produces: `useToday(): string` (local day key, re-derived on visibility change and every minute); `<PawRow filled target color label onStamp? busy? />`; `<HabitCard goal state members me onToggle(goal, current) busy? menu? />`; `<HorizonTabs value onChange />`; `<NewGoalDialog horizon members me parents open onOpenChange onCreated(goal) ctx={{ coupleId, uid, today }} />` (Task 9 adds `editing`/`onSaved`).
- Consumes: `useDen`, `useCoupleData`, `timelineView`, `useHabitToggle`, `createGoal`, `parentCandidates`, `colorFor`, `springs`, `PRESS_SCALE`.

- [ ] **Step 1: `useToday`**

`src/hooks/use-today.ts`:

```ts
import { useEffect, useState } from "react";
import { localDayKey } from "@/lib/day";

const MINUTE_MS = 60_000;

/** The visitor's local day, kept current across midnight and app resumes. */
export function useToday(): string {
  const [today, setToday] = useState(() => localDayKey());
  useEffect(() => {
    const tick = () => setToday(localDayKey());
    const id = window.setInterval(tick, MINUTE_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return today;
}
```

- [ ] **Step 2: Paw row and habit card**

`src/components/goals/paw-row.tsx`:

```tsx
import { PawPrint } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { springs } from "@/lib/motion";

interface Slot {
  id: string;
  index: number;
}

export default function PawRow({
  filled,
  target,
  color,
  label,
  onStamp,
  busy = false,
}: {
  filled: number;
  target: number;
  color: string;
  label: string;
  onStamp?: () => void;
  busy?: boolean;
}) {
  const reduced = useReducedMotion();
  const slots: Slot[] = Array.from({ length: target }, (_, index) => ({ id: `slot-${index}`, index }));
  return (
    <div aria-label={`${label}: ${filled} of ${target} paw prints`} className="flex flex-wrap gap-1" role="group">
      {slots.map((slot) => {
        const isFilled = slot.index < filled;
        const isNext = Boolean(onStamp) && slot.index === filled;
        const paw = (
          <motion.span
            animate={{ scale: isFilled ? 1 : 0.9, opacity: isFilled ? 1 : 0.35 }}
            initial={false}
            style={{ color: isFilled ? color : undefined, display: "inline-flex" }}
            transition={reduced ? { duration: 0.12 } : springs.bouncy}
          >
            <PawPrint aria-hidden="true" className="size-6" fill={isFilled ? "currentColor" : "none"} />
          </motion.span>
        );
        if (isNext) {
          return (
            <motion.button
              aria-label="Stamp a paw print"
              className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              disabled={busy}
              key={slot.id}
              onClick={onStamp}
              transition={springs.press}
              type="button"
              whileTap={reduced ? undefined : { scale: 0.9 }}
            >
              {paw}
            </motion.button>
          );
        }
        return (
          <span className="flex size-11 items-center justify-center" key={slot.id}>
            {paw}
          </span>
        );
      })}
    </div>
  );
}
```

`src/components/goals/habit-card.tsx`:

```tsx
import { PawPrint } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback } from "react";
import { colorFor } from "@/components/partner-dot";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { type Goal, type Member, SHARED_OWNER } from "@/lib/domain";
import type { HabitState } from "@/lib/ladder";
import { PRESS_SCALE, springs } from "@/lib/motion";

function stamperLabel(mine: boolean, done: boolean, name: string): string {
  if (mine) {
    return done ? "Undo today's paw" : "Stamp today's paw";
  }
  return done ? `${name} stamped today` : `${name} hasn't stamped yet`;
}

function StamperRow({
  goal,
  member,
  me,
  done,
  strip,
  stripDays,
  busy,
  onToggle,
}: {
  goal: Goal;
  member: Member;
  me: string;
  done: boolean;
  strip: boolean[];
  stripDays: string[];
  busy: boolean;
  onToggle: (goal: Goal, current: boolean) => void;
}) {
  const theme = useResolvedTheme();
  const reduced = useReducedMotion();
  const mine = member.id === me;
  const color = colorFor(member.color, theme);
  const onClick = useCallback(() => onToggle(goal, done), [onToggle, goal, done]);
  return (
    <div className="flex items-center gap-3">
      <motion.button
        aria-label={stamperLabel(mine, done, member.displayName)}
        aria-pressed={done}
        className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        disabled={!mine || busy}
        onClick={onClick}
        style={{ borderColor: color, background: done ? color : "transparent", color: done ? "#fff" : color }}
        transition={springs.press}
        type="button"
        whileTap={mine && !reduced ? { scale: PRESS_SCALE } : undefined}
      >
        <PawPrint className="size-6" fill={done ? "currentColor" : "none"} />
      </motion.button>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm">{mine ? "You" : member.displayName}</p>
        <div aria-label={`Last 7 days for ${member.displayName}`} className="mt-1 flex gap-1" role="group">
          {strip.map((on, i) => (
            <span className="size-2 rounded-full" key={stripDays[i] ?? String(i)} style={{ background: on ? color : "var(--border)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HabitCard({
  goal,
  state,
  members,
  me,
  busy = false,
  onToggle,
  menu,
}: {
  goal: Goal;
  state: HabitState | undefined;
  members: Member[];
  me: string;
  busy?: boolean;
  onToggle: (goal: Goal, current: boolean) => void;
  menu?: React.ReactNode;
}) {
  const theme = useResolvedTheme();
  const shared = goal.owner === SHARED_OWNER;
  const stampers = shared ? members : members.filter((m) => m.id === goal.owner);
  const owner = members.find((m) => m.id === goal.owner);
  const gradient = members.map((m) => colorFor(m.color, theme));
  const accent = shared ? `linear-gradient(90deg, ${gradient.join(", ")})` : colorFor(owner?.color ?? "rose", theme);
  const streak = state && state.streakDays > 1 ? ` · ${state.streakDays} days in a row` : "";

  return (
    <article className="island-shell min-w-0 overflow-hidden p-4 sm:p-5">
      <div aria-hidden="true" className="-mx-4 -mt-4 mb-4 h-1.5 sm:-mx-5 sm:-mt-5" style={{ background: accent }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="display-title m-0 truncate text-lg">
            {goal.charm ? <span className="mr-1.5">{goal.charm}</span> : null}
            {goal.title}
          </h3>
          <p className="m-0 text-muted-foreground text-xs">
            {shared ? "Together" : owner?.displayName}
            {streak}
          </p>
        </div>
        {menu}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {stampers.map((m) => (
          <StamperRow
            busy={busy}
            done={state?.todayBy[m.id] ?? false}
            goal={goal}
            key={m.id}
            me={me}
            member={m}
            onToggle={onToggle}
            strip={state?.last7[m.id] ?? []}
            stripDays={state?.stripDays ?? []}
          />
        ))}
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Horizon tabs and the new-goal dialog**

`src/components/goals/horizon-tabs.tsx`:

```tsx
import { useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HORIZONS, type Horizon } from "@/lib/domain";

const LABELS: Record<Horizon, string> = { day: "Day", month: "Month", quarter: "Quarter", year: "Year" };

function isHorizon(value: string): value is Horizon {
  return (HORIZONS as readonly string[]).includes(value);
}

export default function HorizonTabs({ value, onChange }: { value: Horizon; onChange: (h: Horizon) => void }) {
  const onValueChange = useCallback(
    (v: string) => {
      if (isHorizon(v)) {
        onChange(v);
      }
    },
    [onChange]
  );
  return (
    <Tabs onValueChange={onValueChange} value={value}>
      <TabsList>
        {HORIZONS.map((h) => (
          <TabsTrigger key={h} value={h}>
            {LABELS[h]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

`src/components/goals/new-goal-dialog.tsx`:

```tsx
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { createGoal } from "@/data/mutations";
import {
  GOAL_TARGET_MAX,
  GOAL_TARGET_MIN,
  GOAL_TITLE_MAX,
  type Goal,
  type Horizon,
  type Member,
  SHARED_OWNER,
} from "@/lib/domain";

const HORIZON_HINT: Record<Horizon, string> = {
  day: "A habit that shows up every day. One paw per person per day.",
  month: "A milestone for this month, filled with paw prints.",
  quarter: "A bigger milestone for this quarter.",
  year: "The dream for this year.",
};
// UTF-16 units, not glyphs: a ZWJ family emoji is 8 units.
const CHARM_INPUT_MAX = 16;
const DEFAULT_TARGET = 3;

export interface GoalDialogContext {
  coupleId: string;
  uid: string;
  today: string;
}

export default function NewGoalDialog({
  horizon,
  members,
  me,
  parents,
  open,
  onOpenChange,
  onCreated,
  ctx,
}: {
  horizon: Horizon;
  members: Member[];
  me: string;
  parents: Goal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (goal: Goal) => void;
  ctx: GoalDialogContext;
}) {
  const [title, setTitle] = useState("");
  const [charm, setCharm] = useState("");
  const [owner, setOwner] = useState<string>(me);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [parentGoalId, setParentGoalId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onTitle = useCallback((e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value), []);
  const onCharm = useCallback((e: ChangeEvent<HTMLInputElement>) => setCharm(e.target.value), []);
  const onOwner = useCallback((e: ChangeEvent<HTMLSelectElement>) => setOwner(e.target.value), []);
  const onTarget = useCallback((e: ChangeEvent<HTMLInputElement>) => setTarget(Number(e.target.value)), []);
  const onParent = useCallback((e: ChangeEvent<HTMLSelectElement>) => setParentGoalId(e.target.value), []);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const goal = await createGoal({
          coupleId: ctx.coupleId,
          uid: ctx.uid,
          today: ctx.today,
          input: {
            title,
            charm: charm || null,
            horizon,
            owner,
            targetUnits: horizon === "day" ? null : target,
            parentGoalId: parentGoalId || null,
          },
        });
        setTitle("");
        setCharm("");
        setParentGoalId("");
        onCreated(goal);
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save the goal.");
      } finally {
        setBusy(false);
      }
    },
    [ctx, title, charm, horizon, owner, target, parentGoalId, onCreated, onOpenChange]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New {horizon === "day" ? "habit" : "goal"}</DialogTitle>
          <DialogDescription>{HORIZON_HINT[horizon]}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-title">Title</Label>
              <Input id="goal-title" maxLength={GOAL_TITLE_MAX} onChange={onTitle} required value={title} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-charm">Charm</Label>
              <Input id="goal-charm" maxLength={CHARM_INPUT_MAX} onChange={onCharm} placeholder="🐾" value={charm} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-owner">Whose goal</Label>
            <NativeSelect id="goal-owner" onChange={onOwner} value={owner}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me ? "Mine" : `${m.displayName}'s`}
                </option>
              ))}
              <option value={SHARED_OWNER}>Ours, together</option>
            </NativeSelect>
          </div>
          {horizon === "day" ? null : (
            <div className="space-y-2">
              <Label htmlFor="goal-target">Paw prints to fill</Label>
              <Input id="goal-target" inputMode="numeric" max={GOAL_TARGET_MAX} min={GOAL_TARGET_MIN} onChange={onTarget} type="number" value={target} />
            </div>
          )}
          {parents.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="goal-parent">Climbs toward</Label>
              <NativeSelect id="goal-parent" onChange={onParent} value={parentGoalId}>
                <option value="">Nothing bigger (yet)</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.charm ? `${p.charm} ` : ""}
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={close} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={busy || title.trim().length === 0} type="submit">
              {owner === SHARED_OWNER ? "Create and seal" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: The Timeline page (Day tab; Task 9 adds the rest)**

`src/pages/timeline.tsx`:

```tsx
import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ErrorPanel } from "@/components/error-panel";
import HabitCard from "@/components/goals/habit-card";
import HorizonTabs from "@/components/goals/horizon-tabs";
import NewGoalDialog from "@/components/goals/new-goal-dialog";
import { Button } from "@/components/ui/button";
import { useCoupleData } from "@/data/use-couple-data";
import { useHabitToggle } from "@/hooks/use-habit-toggle";
import { useToday } from "@/hooks/use-today";
import { HORIZONS, type Horizon, SHARED_OWNER } from "@/lib/domain";
import { parentCandidates } from "@/lib/goals";
import { isValidPeriod } from "@/lib/periods";
import { timelineView } from "@/lib/views";
import { useDen } from "@/data/den-context";

function isHorizon(value: string | null): value is Horizon {
  return value !== null && (HORIZONS as readonly string[]).includes(value);
}

export default function TimelinePage() {
  const { me } = useDen();
  const today = useToday();
  const { data, error, refresh } = useCoupleData(me.couple.id, today);
  const [params, setParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const hParam = params.get("h");
  const h: Horizon = isHorizon(hParam) ? hParam : "day";
  const periodParam = params.get("period");
  const period = periodParam && isValidPeriod(periodParam) ? periodParam : undefined;

  const ctx = useMemo(() => ({ coupleId: me.couple.id, me: me.userId, refresh }), [me.couple.id, me.userId, refresh]);
  const habitToggle = useHabitToggle(ctx);

  // Switching horizon drops any period so a memory view never leaks across tabs.
  const setHorizon = useCallback((next: Horizon) => setParams({ h: next }), [setParams]);
  const openDialog = useCallback(() => setDialogOpen(true), []);
  const onCreated = useCallback(() => {
    void refresh();
  }, [refresh]);

  if (error) {
    return <ErrorPanel error={error} />;
  }
  if (!data) {
    return (
      <section className="page-wrap py-10">
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      </section>
    );
  }

  const view = timelineView(data, me.userId, today);
  const habits = view.goals.filter((g) => g.horizon === "day");
  const mine = habits.filter((g) => g.owner === view.me || g.owner === SHARED_OWNER);
  const theirs = habits.filter((g) => g.owner !== view.me && g.owner !== SHARED_OWNER);

  return (
    <section className="page-wrap py-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="island-kicker mb-1">Timeline</p>
          <h1 className="display-title m-0 text-3xl">Our goals</h1>
        </div>
        <Button onClick={openDialog} type="button">
          <Plus /> New {h === "day" ? "habit" : "goal"}
        </Button>
      </div>
      <HorizonTabs onChange={setHorizon} value={h} />

      {h === "day" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {habits.length === 0 ? (
            <p className="text-muted-foreground text-sm">No habits yet. Add the first small thing you'll do every day.</p>
          ) : null}
          {[...mine, ...theirs].map((goal) => (
            <HabitCard
              busy={habitToggle.busy.has(goal.id)}
              goal={goal}
              key={goal.id}
              me={view.me}
              members={view.members}
              onToggle={habitToggle.toggle}
              state={habitToggle.view(goal.id, view.habits[goal.id])}
            />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-muted-foreground text-sm">Milestones arrive in the next step. (period: {period ?? "current"})</p>
      )}

      <NewGoalDialog
        ctx={{ coupleId: me.couple.id, uid: me.userId, today }}
        horizon={h}
        me={view.me}
        members={view.members}
        onCreated={onCreated}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        parents={parentCandidates(view.goals, h, today)}
      />
    </section>
  );
}
```

Wire `/goals` → `<TimelinePage />` in `src/routes.tsx`.

- [ ] **Step 5: Verify**

`npm run fix && npm run check && npm test`. Browser A: `/goals` → New habit "Walk 20 min" (mine) and a shared one. Tap the paw → fills instantly (optimistic), stays after the round trip; the 7-day strip lights today; tap again → undo. Go offline (DevTools) and tap → the paw reverts and a toast explains. Partner's row is disabled. Browser B: their tap appears in A within a second (Realtime), no reload. Mobile sweep at 320/375/768/1280 on `/goals`: cards single-column at 320, the dialog is a bottom sheet under 640 with its content scrolling, tabs fit on one row.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "Add the daily habits tab with optimistic paws and live partner updates

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The Den: today strip, ticker, hearts, partner activity, install hint

**Files:**
- Create: `src/hooks/den-diff.ts`, `src/hooks/den-diff.test.ts`, `src/hooks/use-partner-activity.ts`, `src/hooks/use-is-standalone.ts`, `src/components/den/today-strip.tsx`, `src/components/den/ticker.tsx`, `src/components/install-hint.tsx`, `src/pages/den.tsx`
- Modify: `src/routes.tsx` (`/den` → `<DenPage />`)

**Interfaces:**
- Produces (`den-diff.ts`): `diffDen(prev: DenData | null, next: DenData, me): { partnerStamps: TickerItem[]; newHeartsOnMine: number }`.
- Produces (`use-partner-activity.ts`): `usePartnerActivity(data: DenData, handlers: { onPartnerStamp(item, member); onHeart(count) })`.
- Produces (`use-is-standalone.ts`): `useIsStandalone(): boolean`, `isIos(): boolean`.
- Produces: `<TodayStrip habits states members me toggle />`, `<Ticker items members me onHeart />`, `<InstallHint />` (iOS Safari only, dismissible).

- [ ] **Step 1: Diff test and implementation**

`src/hooks/den-diff.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { TickerItem } from "@/lib/domain";
import type { DenData } from "@/lib/views";
import { diffDen } from "./den-diff";

const item = (id: string, uid: string, reactions: Record<string, "heart"> = {}): TickerItem => ({
  checkinId: id, uid, goalId: "g", goalTitle: "Walk", charm: null, at: "2026-09-17T10:00:00.000Z", reactions,
});

const den = (ticker: TickerItem[]): DenData => ({
  habits: [], habitStates: {}, ticker, waitingForMySeal: [], lastCheckInAt: null, todayCount: 0,
  members: [], me: "a", today: "2026-09-17", pupName: null,
});

describe("diffDen", () => {
  test("first load reports nothing", () => {
    expect(diffDen(null, den([item("1", "b")]), "a")).toEqual({ partnerStamps: [], newHeartsOnMine: 0 });
  });

  test("new partner stamps are reported, my own are not", () => {
    const prev = den([item("1", "b")]);
    const next = den([item("3", "a"), item("2", "b"), item("1", "b")]);
    expect(diffDen(prev, next, "a").partnerStamps.map((i) => i.checkinId)).toEqual(["2"]);
  });

  test("a heart appearing on my stamp counts once", () => {
    const prev = den([item("1", "a")]);
    const next = den([item("1", "a", { b: "heart" })]);
    expect(diffDen(prev, next, "a").newHeartsOnMine).toBe(1);
    expect(diffDen(next, next, "a").newHeartsOnMine).toBe(0);
  });
});
```

`src/hooks/den-diff.ts`:

```ts
import type { TickerItem } from "@/lib/domain";
import type { DenData } from "@/lib/views";

export interface DenDiff {
  partnerStamps: TickerItem[];
  newHeartsOnMine: number;
}

/** What changed between two Den views, from my point of view. */
export function diffDen(prev: DenData | null, next: DenData, me: string): DenDiff {
  if (!prev) {
    return { partnerStamps: [], newHeartsOnMine: 0 };
  }
  const seen = new Map(prev.ticker.map((t) => [t.checkinId, t]));
  const partnerStamps = next.ticker.filter((t) => t.uid !== me && !seen.has(t.checkinId));
  let newHeartsOnMine = 0;
  for (const t of next.ticker) {
    if (t.uid !== me) {
      continue;
    }
    const before = Object.keys(seen.get(t.checkinId)?.reactions ?? {}).length;
    const after = Object.keys(t.reactions).length;
    if (after > before) {
      newHeartsOnMine += after - before;
    }
  }
  return { partnerStamps, newHeartsOnMine };
}
```

Run `npm test -- den-diff`: pass.

- [ ] **Step 2: Partner activity, standalone detection, install hint**

`src/hooks/use-partner-activity.ts`:

```ts
import { useEffect, useRef } from "react";
import type { Member, TickerItem } from "@/lib/domain";
import type { DenData } from "@/lib/views";
import { diffDen } from "./den-diff";

export function usePartnerActivity(
  data: DenData,
  handlers: { onPartnerStamp: (item: TickerItem, member: Member) => void; onHeart: (count: number) => void }
): void {
  const prev = useRef<DenData | null>(null);
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const diff = diffDen(prev.current, data, data.me);
    prev.current = data;
    for (const item of diff.partnerStamps) {
      const member = data.members.find((m) => m.id === item.uid);
      if (member) {
        latest.current.onPartnerStamp(item, member);
      }
    }
    if (diff.newHeartsOnMine > 0) {
      latest.current.onHeart(diff.newHeartsOnMine);
    }
  }, [data]);
}
```

`src/hooks/use-is-standalone.ts`:

```ts
import { useEffect, useState } from "react";

const IOS_RE = /iphone|ipad|ipod/i;

export function isIos(): boolean {
  return IOS_RE.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** True when running as an installed app (home screen), not in a browser tab. */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(() => window.matchMedia("(display-mode: standalone)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setStandalone(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const nav = navigator as Navigator & { standalone?: boolean };
  return standalone || nav.standalone === true;
}
```

`src/components/install-hint.tsx`:

```tsx
import { Share, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { isIos, useIsStandalone } from "@/hooks/use-is-standalone";

const DISMISS_KEY = "couplegoal.install-hint.dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** iOS has no install prompt API; the hint explains the Share → Add to Home Screen route. */
export default function InstallHint() {
  const standalone = useIsStandalone();
  const [dismissed, setDismissed] = useState(readDismissed);
  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode: the hint simply comes back next visit.
    }
  }, []);
  if (standalone || dismissed || !isIos()) {
    return null;
  }
  return (
    <aside className="island-shell mb-6 flex items-start gap-3 p-4">
      <Share aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
      <p className="m-0 flex-1 text-sm">
        Keep us on your Home Screen: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
      </p>
      <Button aria-label="Dismiss" onClick={dismiss} size="icon" type="button" variant="ghost">
        <X className="size-5" />
      </Button>
    </aside>
  );
}
```

- [ ] **Step 3: Ticker and today strip**

`src/components/den/ticker.tsx`:

```tsx
import { Heart } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback } from "react";
import PartnerDot, { colorFor } from "@/components/partner-dot";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import type { Member, TickerItem } from "@/lib/domain";
import { springs } from "@/lib/motion";

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function timeAgo(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / MINUTE_MS));
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return `${hours} h ago`;
  }
  return `${Math.round(hours / HOURS_PER_DAY)} d ago`;
}

function HeartsOnMine({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }
  return <Heart aria-label={`${count} heart from your partner`} className="size-5 fill-primary text-primary" />;
}

function TickerRow({
  item,
  member,
  me,
  now,
  onHeart,
}: {
  item: TickerItem;
  member: Member;
  me: string;
  now: Date;
  onHeart: (item: TickerItem) => void;
}) {
  const theme = useResolvedTheme();
  const reduced = useReducedMotion();
  const mine = item.uid === me;
  const hearted = Boolean(item.reactions[me]);
  const onClick = useCallback(() => onHeart(item), [onHeart, item]);
  return (
    <li className="flex items-center gap-3">
      <PartnerDot color={member.color} label={member.displayName} />
      <p className="m-0 min-w-0 flex-1 text-sm">
        <span className="font-semibold" style={{ color: colorFor(member.color, theme) }}>
          {mine ? "You" : member.displayName}
        </span>
        {" stamped "}
        <span className="font-semibold">
          {item.charm ? `${item.charm} ` : ""}
          {item.goalTitle}
        </span>
        <span className="text-muted-foreground"> · {timeAgo(item.at, now)}</span>
      </p>
      {mine ? (
        <HeartsOnMine count={Object.keys(item.reactions).length} />
      ) : (
        <motion.button
          aria-label={hearted ? "You sent a heart" : `Send ${member.displayName} a heart`}
          aria-pressed={hearted}
          className="flex size-11 items-center justify-center rounded-full text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={hearted}
          onClick={onClick}
          transition={springs.bouncy}
          type="button"
          whileTap={reduced ? undefined : { scale: 1.3 }}
        >
          <Heart className="size-5" fill={hearted ? "currentColor" : "none"} />
        </motion.button>
      )}
    </li>
  );
}

export default function Ticker({
  items,
  members,
  me,
  onHeart,
}: {
  items: TickerItem[];
  members: Member[];
  me: string;
  onHeart: (item: TickerItem) => void;
}) {
  const now = new Date();
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No paw prints yet. The first one is always the cutest.</p>;
  }
  return (
    <ul className="m-0 list-none space-y-3 p-0">
      {items.map((item) => {
        const member = members.find((m) => m.id === item.uid);
        return member ? <TickerRow item={item} key={item.checkinId} me={me} member={member} now={now} onHeart={onHeart} /> : null;
      })}
    </ul>
  );
}
```

`src/components/den/today-strip.tsx`:

```tsx
import { Link } from "react-router";
import HabitCard from "@/components/goals/habit-card";
import type { HabitToggle } from "@/hooks/use-habit-toggle";
import type { Goal, Member } from "@/lib/domain";
import type { HabitState } from "@/lib/ladder";

export default function TodayStrip({
  habits,
  states,
  members,
  me,
  toggle,
}: {
  habits: Goal[];
  states: Record<string, HabitState>;
  members: Member[];
  me: string;
  toggle: HabitToggle;
}) {
  if (habits.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No daily habits yet.{" "}
        <Link className="underline" to="/goals?h=day">
          Add one on the Timeline
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {habits.map((goal) => (
        <HabitCard
          busy={toggle.busy.has(goal.id)}
          goal={goal}
          key={goal.id}
          me={me}
          members={members}
          onToggle={toggle.toggle}
          state={toggle.view(goal.id, states[goal.id])}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: The Den page**

`src/pages/den.tsx`:

```tsx
import { Copy } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import Ticker from "@/components/den/ticker";
import TodayStrip from "@/components/den/today-strip";
import { ErrorPanel } from "@/components/error-panel";
import InstallHint from "@/components/install-hint";
import { colorFor } from "@/components/partner-dot";
import { Button } from "@/components/ui/button";
import { sendHeart } from "@/data/mutations";
import { useCoupleData } from "@/data/use-couple-data";
import { useHabitToggle } from "@/hooks/use-habit-toggle";
import { usePartnerActivity } from "@/hooks/use-partner-activity";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { useToday } from "@/hooks/use-today";
import { type Goal, MAX_MEMBERS, type Member, type TickerItem } from "@/lib/domain";
import { type DenData, denView } from "@/lib/views";
import { useDen } from "@/data/den-context";

function WaitingForPartner({ code }: { code: string }) {
  const copy = useCallback(() => {
    void navigator.clipboard.writeText(code);
    toast("Code copied");
  }, [code]);
  return (
    <section className="island-shell mb-6 flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="island-kicker mb-1">Waiting for your partner</p>
        <p className="m-0 text-muted-foreground text-sm">Share this code and you'll be in the same den.</p>
      </div>
      <span className="font-heading text-2xl tracking-[0.3em]">{code}</span>
      <Button onClick={copy} size="sm" type="button" variant="outline">
        <Copy /> Copy
      </Button>
    </section>
  );
}

function WaitingForMySeal({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) {
    return null;
  }
  return (
    <section className="island-shell mb-6 p-4">
      <p className="island-kicker mb-1">Waiting for your paw</p>
      <ul className="m-0 list-none space-y-1 p-0 text-sm">
        {goals.map((g) => (
          <li key={g.id}>
            <Link className="inline-flex min-h-11 items-center underline" to={`/goals?h=${g.horizon}`}>
              {g.charm ? `${g.charm} ` : ""}
              {g.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DenContent({ view, coupleId, refresh, inviteCode }: { view: DenData; coupleId: string; refresh: () => Promise<unknown>; inviteCode: string | null }) {
  const theme = useResolvedTheme();
  const ctx = useMemo(() => ({ coupleId, me: view.me, refresh }), [coupleId, view.me, refresh]);
  const habitToggle = useHabitToggle(ctx);

  const onPartnerStamp = useCallback(
    (item: TickerItem, member: Member) =>
      toast(`${member.displayName} stamped ${item.goalTitle}`, { style: { borderColor: colorFor(member.color, theme) } }),
    [theme]
  );
  const onHeart = useCallback(() => toast("Your partner sent you a heart"), []);
  usePartnerActivity(view, { onPartnerStamp, onHeart });

  const heart = useCallback(
    async (item: TickerItem) => {
      try {
        await sendHeart({ checkinId: item.checkinId, uid: view.me, coupleId });
        await refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The heart got lost. Try again?");
      }
    },
    [view.me, coupleId, refresh]
  );

  const pup = view.pupName ?? "your pup";

  return (
    <section className="page-wrap py-6 sm:py-10">
      <InstallHint />
      <div className="island-shell mb-6 flex min-h-[280px] items-center justify-center p-6" id="pup-stage-slot">
        <p className="m-0 text-muted-foreground text-sm">{pup} is on the way (Task 11).</p>
      </div>
      {view.members.length < MAX_MEMBERS && inviteCode ? <WaitingForPartner code={inviteCode} /> : null}
      <WaitingForMySeal goals={view.waitingForMySeal} />
      <div className="mb-10">
        <p className="island-kicker mb-1">Today</p>
        <h1 className="display-title mt-0 mb-4 text-2xl">One paw at a time</h1>
        <TodayStrip habits={view.habits} me={view.me} members={view.members} states={view.habitStates} toggle={habitToggle} />
      </div>
      <div>
        <p className="island-kicker mb-1">Lately</p>
        <h2 className="display-title mt-0 mb-4 text-2xl">Paw prints</h2>
        <Ticker items={view.ticker} me={view.me} members={view.members} onHeart={heart} />
      </div>
    </section>
  );
}

export default function DenPage() {
  const { me } = useDen();
  const today = useToday();
  const { data, error, refresh } = useCoupleData(me.couple.id, today);
  if (error) {
    return <ErrorPanel error={error} />;
  }
  if (!data) {
    return (
      <section className="page-wrap py-10">
        <div className="h-[280px] animate-pulse rounded-3xl bg-muted" />
      </section>
    );
  }
  const view = denView(data, me.userId, today);
  return <DenContent coupleId={me.couple.id} inviteCode={data.couple.inviteCode} refresh={refresh} view={view} />;
}
```

Wire `/den` → `<DenPage />` in `src/routes.tsx`.

- [ ] **Step 5: Verify**

`npm run fix && npm run check && npm test`. Browser: the Den shows today's habits and the ticker; a solo user sees the share-code card; an unsealed shared goal shows under "Waiting for your paw" for the partner who hasn't sealed. Two browsers: partner stamps → a toast in their colour appears on the other side within a second; send a heart → the partner sees the filled heart and a toast; hearting your own stamp is impossible (no button). Mobile sweep on `/den` at 320/375/768/1280; the install hint shows only when the user agent is iOS (Playwright: emulate iPhone to see it, dismiss it, reload, gone).

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "Add the Den with today strip, ticker, hearts and the iOS install hint

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Stage 4: The ladder

### Task 9: Month, Quarter and Year tabs, nesting, period picker, editing, the seal

**Files:**
- Create: `src/components/goals/period-picker.tsx`, `src/components/goals/goal-menu.tsx`, `src/components/goals/milestone-card.tsx`, `src/components/goals/seal-dialog.tsx`
- Modify: `src/components/goals/new-goal-dialog.tsx` (editing mode), `src/pages/timeline.tsx`

**Interfaces:**
- Produces: `<PeriodPicker period current onChange />`, `<GoalMenu goal canUndo onEdit onUndo? onArchive />`, `<MilestoneCard goal progress parent childGoals progressById members me readOnly busy? onStamp onSeal menu? />`, `<SealDialog goal members me open onOpenChange onSeal />`; `NewGoalDialog` gains `editing?: Goal | null` and `onSaved?: (goal: Goal) => void`.
- Consumes: `TimelineData`, `stamp`, `undoLastMilestonePaw`, `sealGoal`, `archiveGoal`, `updateGoal`, `PawRow`, `filledPaws`, `periodLabel`, `shiftPeriod`, `periodFor`, `horizonOfPeriod`, `isSealed`, `computeProgress`.

- [ ] **Step 1: Period picker and goal menu**

`src/components/goals/period-picker.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { periodLabel, shiftPeriod } from "@/lib/periods";

export default function PeriodPicker({
  period,
  current,
  onChange,
}: {
  period: string;
  current: string;
  onChange: (period: string) => void;
}) {
  const isCurrent = period === current;
  const earlier = useCallback(() => onChange(shiftPeriod(period, -1)), [onChange, period]);
  const later = useCallback(() => onChange(shiftPeriod(period, 1)), [onChange, period]);
  return (
    <div className="flex items-center gap-1">
      <Button aria-label="Earlier" onClick={earlier} size="icon" type="button" variant="ghost">
        <ChevronLeft className="size-5" />
      </Button>
      <span className="min-w-[9rem] text-center font-heading text-lg">
        {periodLabel(period)}
        {isCurrent ? null : <span className="ml-2 text-muted-foreground text-xs">memory</span>}
      </span>
      <Button aria-label="Later" disabled={isCurrent} onClick={later} size="icon" type="button" variant="ghost">
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}
```

`src/components/goals/goal-menu.tsx`:

```tsx
import { Ellipsis } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Goal } from "@/lib/domain";

export default function GoalMenu({
  goal,
  canUndo = false,
  onEdit,
  onUndo,
  onArchive,
}: {
  goal: Goal;
  canUndo?: boolean;
  onEdit: (goal: Goal) => void;
  onUndo?: (goal: Goal) => void;
  onArchive: (goal: Goal) => void;
}) {
  const edit = useCallback(() => onEdit(goal), [onEdit, goal]);
  const undo = useCallback(() => onUndo?.(goal), [onUndo, goal]);
  const archive = useCallback(() => onArchive(goal), [onArchive, goal]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Options for ${goal.title}`} size="icon" type="button" variant="ghost">
          <Ellipsis className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={edit}>Edit</DropdownMenuItem>
        {canUndo && onUndo ? <DropdownMenuItem onSelect={undo}>Take back my last paw</DropdownMenuItem> : null}
        <DropdownMenuItem onSelect={archive}>Tuck away (archive)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

If the installed `lucide-react` has no `Ellipsis`, use `MoreHorizontal`; check with `grep -c "Ellipsis" node_modules/lucide-react/dist/lucide-react.d.ts`.

- [ ] **Step 2: Milestone card**

`src/components/goals/milestone-card.tsx`:

```tsx
import { Stamp } from "lucide-react";
import { useCallback } from "react";
import PawRow from "@/components/goals/paw-row";
import { colorFor } from "@/components/partner-dot";
import { Button } from "@/components/ui/button";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { type Goal, isSealed, type Member, SHARED_OWNER } from "@/lib/domain";
import { filledPaws, type GoalProgress } from "@/lib/ladder";

const PERCENT = 100;

function childLabel(child: Goal, cp: GoalProgress | undefined): string {
  if (child.horizon === "day") {
    return "daily habit";
  }
  return cp ? `${filledPaws(cp)}/${cp.target}` : "";
}

function sealLabel(mySeal: boolean): string {
  return mySeal ? "Waiting for their paw" : "Waiting for your paw";
}

export default function MilestoneCard({
  goal,
  progress,
  parent,
  childGoals,
  progressById,
  members,
  me,
  readOnly,
  busy = false,
  onStamp,
  onSeal,
  menu,
}: {
  goal: Goal;
  progress: GoalProgress | undefined;
  parent: Goal | undefined;
  childGoals: Goal[];
  progressById: Record<string, GoalProgress>;
  members: Member[];
  me: string;
  readOnly: boolean;
  busy?: boolean;
  onStamp: (goal: Goal) => void;
  onSeal: (goal: Goal) => void;
  menu?: React.ReactNode;
}) {
  const theme = useResolvedTheme();
  const owner = members.find((m) => m.id === goal.owner);
  const shared = goal.owner === SHARED_OWNER;
  const gradient = members.map((m) => colorFor(m.color, theme));
  const accent = shared ? `linear-gradient(90deg, ${gradient.join(", ")})` : colorFor(owner?.color ?? "rose", theme);
  const pawColor = shared ? (gradient[0] ?? "") : colorFor(owner?.color ?? "rose", theme);
  const canStamp = !readOnly && (shared || goal.owner === me) && progress !== undefined && !progress.complete;
  const sealed = isSealed(goal, members.map((m) => m.id));
  const mySeal = Boolean(goal.seals[me]);
  const percent = progress ? Math.round((progress.progress / progress.target) * PERCENT) : 0;
  const stampGoal = useCallback(() => onStamp(goal), [onStamp, goal]);
  const seal = useCallback(() => onSeal(goal), [onSeal, goal]);

  return (
    <article className="island-shell min-w-0 overflow-hidden p-4 sm:p-5">
      <div aria-hidden="true" className="-mx-4 -mt-4 mb-4 h-1.5 sm:-mx-5 sm:-mt-5" style={{ background: accent }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="display-title m-0 truncate text-lg">
            {goal.charm ? <span className="mr-1.5">{goal.charm}</span> : null}
            {goal.title}
          </h3>
          <p className="m-0 text-muted-foreground text-xs">
            {shared ? "Together" : owner?.displayName}
            {progress?.complete ? " · done!" : ""}
          </p>
          {parent ? (
            <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
              climbs toward {parent.charm ? `${parent.charm} ` : ""}
              {parent.title}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {shared && !sealed && !readOnly ? (
            <Button onClick={seal} size="sm" type="button" variant={mySeal ? "ghost" : "secondary"}>
              <Stamp /> <span className="hidden sm:inline">{sealLabel(mySeal)}</span>
              <span className="sm:hidden">Seal</span>
            </Button>
          ) : null}
          {shared && sealed ? <span className="text-muted-foreground text-xs">Sealed</span> : null}
          {menu}
        </div>
      </div>
      {progress ? (
        <div className="mt-4 space-y-2">
          <PawRow busy={busy} color={pawColor} filled={filledPaws(progress)} label={goal.title} onStamp={canStamp ? stampGoal : undefined} target={progress.target} />
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${percent}%`, background: accent }} />
          </div>
          {progress.ladder > 0 ? (
            <p className="m-0 text-muted-foreground text-xs">
              {progress.ladder.toFixed(1)} paw{progress.ladder === 1 ? "" : "s"} climbed up from smaller goals
            </p>
          ) : null}
        </div>
      ) : null}
      {childGoals.length > 0 ? (
        <ul className="mt-4 list-none space-y-1 border-border border-t pt-3 pl-0">
          {childGoals.map((c) => (
            <li className="flex items-center justify-between gap-2 text-sm" key={c.id}>
              <span className="min-w-0 truncate">
                {c.charm ? `${c.charm} ` : ""}
                {c.title}
              </span>
              <span className="shrink-0 text-muted-foreground text-xs">{childLabel(c, progressById[c.id])}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 3: Seal dialog**

`src/components/goals/seal-dialog.tsx`. The dialog always receives the live goal (the partner's seal arrives by Realtime and the second wax fills while it is open):

```tsx
import { Stamp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";
import { colorFor } from "@/components/partner-dot";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import type { Goal, Member } from "@/lib/domain";
import { springs } from "@/lib/motion";

const SEAL_CLOSE_MS = 600;

export default function SealDialog({
  goal,
  members,
  me,
  open,
  onOpenChange,
  onSeal,
}: {
  goal: Goal | null;
  members: Member[];
  me: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSeal: (goal: Goal) => Promise<void>;
}) {
  const theme = useResolvedTheme();
  const reduced = useReducedMotion();
  const [pressing, setPressing] = useState(false);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const press = useCallback(async () => {
    if (!goal) {
      return;
    }
    setPressing(true);
    try {
      await onSeal(goal);
      window.setTimeout(() => onOpenChange(false), SEAL_CLOSE_MS);
    } finally {
      window.setTimeout(() => setPressing(false), SEAL_CLOSE_MS);
    }
  }, [goal, onSeal, onOpenChange]);

  if (!goal) {
    return null;
  }
  const mine = Boolean(goal.seals[me]);
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seal the deal</DialogTitle>
          <DialogDescription>A shared goal deserves both your paws on it: {goal.title}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-8 py-6">
          {members.map((m) => {
            const done = Boolean(goal.seals[m.id]);
            return (
              <motion.div
                animate={done ? { scale: [1.4, 1], rotate: [-8, 0], opacity: 1 } : { scale: 1, opacity: 0.3 }}
                className="flex size-20 items-center justify-center rounded-full text-white"
                initial={false}
                key={m.id}
                style={{ background: colorFor(m.color, theme) }}
                transition={reduced ? { duration: 0.12 } : springs.bouncy}
              >
                <Stamp className="size-8" />
              </motion.div>
            );
          })}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={close} type="button" variant="ghost">
            Later
          </Button>
          <Button disabled={mine || pressing} onClick={press} type="button">
            {mine ? "You've sealed it" : "Press my paw"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Editing in the goal dialog**

In `src/components/goals/new-goal-dialog.tsx` add props `editing?: Goal | null` and `onSaved?: (goal: Goal) => void`, import `updateGoal` from `@/data/mutations` and `useEffect` from react, and:

- Initialise state from `editing` when it changes:

```tsx
  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setCharm(editing.charm ?? "");
      setOwner(editing.owner);
      setTarget(editing.targetUnits ?? DEFAULT_TARGET);
      setParentGoalId(editing.parentGoalId ?? "");
    }
  }, [editing]);
```

- In `submit`, branch on `editing`:

```tsx
        if (editing) {
          await updateGoal(editing.id, {
            title,
            charm: charm || null,
            targetUnits: horizon === "day" ? undefined : target,
            parentGoalId: parentGoalId || null,
          });
          onSaved?.({ ...editing, title, charm: charm || null, targetUnits: horizon === "day" ? null : target, parentGoalId: parentGoalId || null });
          onOpenChange(false);
          return;
        }
```

(add `editing` and `onSaved` to the `useCallback` deps). The owner select gets `disabled={Boolean(editing)}` (owner never changes after creation). Title reads `Edit {habit|goal}` and the submit button `Save` when editing.

- [ ] **Step 5: Extend the Timeline page**

In `src/pages/timeline.tsx` add imports: `GoalMenu`, `MilestoneCard`, `PeriodPicker`, `SealDialog` from `@/components/goals/*`; `archiveGoal`, `sealGoal`, `stamp`, `undoLastMilestonePaw` from `@/data/mutations`; `localDayKey` from `@/lib/day`; `type Goal`, `type MilestoneHorizon` from `@/lib/domain`; `horizonOfPeriod`, `periodFor` from `@/lib/periods`; `type TimelineData` from `@/lib/views`; `toast` from `sonner`.

Add state and handlers inside `TimelinePage` after `habitToggle` (they must sit above the early returns, so move the `if (error)` / `if (!data)` returns below this block; `data` may be `undefined` inside the callbacks, guard with `if (!data) return`):

```tsx
  const [sealGoalId, setSealGoalId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [busyGoal, setBusyGoal] = useState<string | null>(null);

  const runGoalAction = useCallback(
    async (goal: Goal, work: () => Promise<void>) => {
      if (busyGoal) {
        return;
      }
      setBusyGoal(goal.id);
      try {
        await work();
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That didn't land. Try again?");
      } finally {
        setBusyGoal(null);
      }
    },
    [busyGoal, refresh]
  );

  const stampMilestone = useCallback(
    (goal: Goal) =>
      runGoalAction(goal, async () => {
        await stamp({ coupleId: me.couple.id, goalId: goal.id, uid: me.userId, day: localDayKey() });
      }),
    [runGoalAction, me.couple.id, me.userId]
  );
  const undoMilestone = useCallback(
    (goal: Goal) =>
      runGoalAction(goal, async () => {
        // Newest own stamp on this goal; data.checkins is newest-first.
        const last = data?.checkins.find((c) => c.goalId === goal.id && c.uid === me.userId);
        if (!last) {
          throw new Error("No paw of yours to take back.");
        }
        await undoLastMilestonePaw(last.id);
      }),
    [runGoalAction, data, me.userId]
  );
  const archive = useCallback(
    (goal: Goal) =>
      runGoalAction(goal, async () => {
        await archiveGoal(goal.id);
      }),
    [runGoalAction]
  );
  const seal = useCallback(
    async (goal: Goal) => {
      await sealGoal(goal.id, me.userId, me.couple.id);
      await refresh();
    },
    [me.userId, me.couple.id, refresh]
  );
  const openSeal = useCallback((goal: Goal) => setSealGoalId(goal.id), []);
  const onSealOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSealGoalId(null);
    }
  }, []);
  const onCreated = useCallback(
    (goal: Goal) => {
      void refresh();
      if (goal.owner === SHARED_OWNER) {
        setSealGoalId(goal.id);
      }
    },
    [refresh]
  );
  const onSaved = useCallback(() => {
    setEditing(null);
    void refresh();
  }, [refresh]);
  const onDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditing(null);
    }
  }, []);
  const edit = useCallback((goal: Goal) => {
    setEditing(goal);
    setDialogOpen(true);
  }, []);
  const setPeriod = useCallback((p: string) => setParams({ h, period: p }), [setParams, h]);
```

(this `onCreated` replaces Task 7's; the dialog gets `onOpenChange={onDialogOpenChange}`, `editing={editing}`, `onSaved={onSaved}`). Task 12 adds the mood triggers to `stampMilestone` and `seal`.

After the early returns: `const sealGoalLive = sealGoalId ? (view.goals.find((g) => g.id === sealGoalId) ?? null) : null;` and `const viewingMemory = h !== "day" && period !== undefined && period !== periodFor(h, today);` → add `disabled={viewingMemory}` to the "New goal" button. Give each `HabitCard` `menu={<GoalMenu goal={goal} onArchive={archive} onEdit={edit} />}`. Replace the `"Milestones arrive in the next step."` paragraph with:

```tsx
        <MilestoneSection
          busyGoal={busyGoal}
          data={view}
          horizon={h}
          onArchive={archive}
          onEdit={edit}
          onSeal={openSeal}
          onStamp={stampMilestone}
          onUndo={undoMilestone}
          period={period}
          setPeriod={setPeriod}
        />
      )}

      <SealDialog goal={sealGoalLive} me={view.me} members={view.members} onOpenChange={onSealOpenChange} onSeal={seal} open={sealGoalLive !== null} />
```

Add `MilestoneSection` as a top-level function below `TimelinePage`:

```tsx
function MilestoneSection({
  data,
  horizon,
  period,
  setPeriod,
  busyGoal,
  onStamp,
  onUndo,
  onSeal,
  onEdit,
  onArchive,
}: {
  data: TimelineData;
  horizon: MilestoneHorizon;
  period: string | undefined;
  setPeriod: (p: string) => void;
  busyGoal: string | null;
  onStamp: (g: Goal) => void;
  onUndo: (g: Goal) => void;
  onSeal: (g: Goal) => void;
  onEdit: (g: Goal) => void;
  onArchive: (g: Goal) => void;
}) {
  const current = periodFor(horizon, data.today);
  // A period from the URL only counts if it belongs to this tab and is not in the future.
  const viewPeriod = period && horizonOfPeriod(period) === horizon && period <= current ? period : current;
  const readOnly = viewPeriod !== current;
  const goals = data.goals.filter((g) => g.horizon === horizon && g.period === viewPeriod);
  const byId = new Map(data.goals.map((g) => [g.id, g]));
  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <PeriodPicker current={current} onChange={setPeriod} period={viewPeriod} />
      </div>
      {goals.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {readOnly ? "Nothing here from back then." : "No goals for this stretch yet. Dream a little?"}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((goal) => {
            const progress = data.progress[goal.id];
            return (
              <MilestoneCard
                busy={busyGoal === goal.id}
                childGoals={data.goals.filter((g) => g.parentGoalId === goal.id)}
                goal={goal}
                key={goal.id}
                me={data.me}
                members={data.members}
                menu={
                  readOnly ? undefined : (
                    <GoalMenu
                      canUndo={(progress?.own ?? 0) > 0 && (goal.owner === data.me || goal.owner === SHARED_OWNER)}
                      goal={goal}
                      onArchive={onArchive}
                      onEdit={onEdit}
                      onUndo={onUndo}
                    />
                  )
                }
                onSeal={onSeal}
                onStamp={onStamp}
                parent={goal.parentGoalId ? byId.get(goal.parentGoalId) : undefined}
                progress={progress}
                progressById={data.progress}
                readOnly={readOnly}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
```

`useCoupleData` keys on the year of `today`, and past periods within the same year render with correct progress; stepping back into a previous year shows that year's goals but its check-ins only from 1 January of the current year (a known limit: memories older than the current year show titles without paws). In the `h === "day" ? … : …` false branch TypeScript narrows `h` to `MilestoneHorizon`, so no cast is needed for `horizon={h}`.

- [ ] **Step 6: Verify**

`npm run fix && npm run check && npm test`. Browser: create a Year goal (3 paws), a Quarter goal climbing toward it (1 paw), a Month goal climbing toward the quarter (2 paws), and a daily habit climbing toward the month. The month card shows a "climbs toward" chip. Stamp the month twice → month done, quarter shows 1/1 done, year shows 1/3 with "1.0 paw climbed up". Stamp a third time → no stamp button (complete); the database also refuses ("Every paw is already on this one") if forced. Take back a paw from the menu → month back to 1/2. Edit the month's title. Create a shared goal → seal dialog opens with your wax pressed; partner opens the Timeline and seals from their card → your open dialog's second wax fills within a second, card reads "Sealed". Step back a period → "memory" label, cards read-only, "New goal" disabled; switch tabs → the period resets. Hand-type `?period=junk` → ignored. Mobile sweep: the seal button collapses to "Seal" under 640, card titles truncate, no sideways scroll at 320.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "Add milestone tabs with the ladder, memories, editing and the seal

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Stage 5: The pup

### Task 10: Model pipeline and 3D dependencies

**Files:**
- Create: `public/models/pup.glb`, `public/models/LICENSE.md`
- Modify: `package.json` (add `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`)

**Interfaces:**
- Produces: `/models/pup.glb` (~642 KB, meshopt + WebP) with the 12 clips recorded in `LICENSE.md`.

- [ ] **Step 1: Fetch the source model**

The rigged GLB lives in the TimelineGoal repo at `assets/models/bulldog-rigged.glb` (3,281,212 bytes):

```bash
git clone -q --depth 1 https://github.com/johnnycuongn/TimelineGoal.git /tmp/tlg-src
mkdir -p public/models
cp /tmp/tlg-src/assets/models/bulldog-rigged.glb /tmp/tlg-src/assets/models/MODEL-LICENSE.md public/models/
```

- [ ] **Step 2: Inspect and optimise**

```bash
npx --yes @gltf-transform/cli@4.5.0 inspect public/models/bulldog-rigged.glb
```

Expected (measured on the source): 12 clips `Attack, Death, Eating, Gallop, Gallop_Jump, Idle, Idle_2, Idle_2_HeadLow, Idle_HitReact_Left, Idle_HitReact_Right, Jump_ToIdle, Walk` (no armature prefix), 1 skin with 46 joints, 2 meshes, 2 materials, two 1024² PNG textures. Then:

```bash
npx --yes @gltf-transform/cli@4.5.0 optimize public/models/bulldog-rigged.glb public/models/pup.glb --compress meshopt --texture-compress webp --texture-size 1024
ls -la public/models
rm public/models/bulldog-rigged.glb
```

Expected (measured earlier): `pup.glb` about 642 KB, all 12 clips intact, textures 2 × 1024² WebP. `optimize` flattens the node tree, so `inspect` reports 2 skins × 46 joints; harmless for three.js. If clips or skins go missing, rerun with `--simplify false --weld false`, or as two steps (`meshopt in out` then `webp in out`).

- [ ] **Step 3: License file**

Rename `MODEL-LICENSE.md` to `LICENSE.md` and append:

```markdown
## pup.glb (this app)

Derived from `bulldog-rigged.glb` above with gltf-transform (meshopt geometry
compression, WebP textures at 1024px). Mesh and textures: "Bulldog Puppy" by
doinspire, CC BY 4.0. Skeleton and animation clips: Quaternius, CC0.

Animation clips: Attack, Death, Eating, Gallop, Gallop_Jump, Idle, Idle_2,
Idle_2_HeadLow, Idle_HitReact_Left, Idle_HitReact_Right, Jump_ToIdle, Walk.
```

- [ ] **Step 4: Install the 3D packages**

```bash
npm install three@0.186.0 @react-three/fiber@9.7.0 @react-three/drei@10.7.8
npm install -D @types/three@0.186.0
npm run fix && npm run check
```

Expected: clean (nothing imports them yet). The model's cache header is already in `vercel.json` (`/models/*` immutable) and the Workbox runtime cache in `vite.config.ts`; when the model changes, bump the filename (`pup-2.glb`) and `PUP_URL`.

- [ ] **Step 5: Commit**

```bash
git add public/models package.json package-lock.json
git commit -m "Add the optimised bulldog model and 3D dependencies

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: The pup stage

**Files:**
- Create: `src/components/pup/idle-scheduler.ts`, `src/components/pup/idle-scheduler.test.ts`, `src/components/pup/pup-mood-context.tsx`, `src/components/pup/pup-url.ts`, `src/components/pup/pup-model.tsx`, `src/components/pup/pup-stage.tsx`, `src/components/pup/pup.tsx`
- Modify: `src/main.tsx` (mount `PupMoodProvider`), `src/pages/den.tsx` (mount `<Pup />`), `index.html` (preload link)

**Interfaces:**
- Produces (`idle-scheduler.ts`): `IDLE_POOL`, `pickIdle(random?, pool?): { clip; holdMs }`, `FIRST_HOLD_MS = 4000`.
- Produces (`pup-mood-context.tsx`): `PupMoodProvider`, `usePupMood(): { mood: Mood; nonce: number; persistent: PersistentMood; trigger(mood: TransientMood); settle(); setPersistent(mood) }`, `TransientMood = "happy" | "party" | "proud" | "love"`.
- Produces (`pup-url.ts`): `PUP_URL = "/models/pup.glb"` (three-free module, safe for any import).
- Produces (`pup.tsx`): `<Pup name className? />` lazy-loaded, with skeleton and "napping" fallbacks.

- [ ] **Step 1: Scheduler test and implementation**

`src/components/pup/idle-scheduler.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { IDLE_POOL, pickIdle } from "./idle-scheduler";

describe("pickIdle", () => {
  test("weights: random 0 picks the first, random just under 1 picks the last", () => {
    expect(pickIdle(() => 0).clip).toBe("Idle");
    expect(pickIdle(() => 0.999_999).clip).toBe("Walk");
  });

  test("hold is inside the clip's window in ms", () => {
    const { clip, holdMs } = pickIdle(() => 0.5);
    const entry = IDLE_POOL.find((e) => e[0] === clip);
    expect(entry).toBeDefined();
    if (entry) {
      expect(holdMs).toBeGreaterThanOrEqual(entry[2] * 1000);
      expect(holdMs).toBeLessThanOrEqual(entry[3] * 1000);
    }
  });

  test("over many draws every clip shows up", () => {
    const seen = new Set<string>();
    let seed = 1;
    const random = () => {
      seed = (seed * 16_807) % 2_147_483_647;
      return seed / 2_147_483_647;
    };
    for (let i = 0; i < 500; i += 1) {
      seen.add(pickIdle(random).clip);
    }
    expect([...seen].sort()).toEqual(["Eating", "Idle", "Idle_2", "Walk"]);
  });
});
```

`src/components/pup/idle-scheduler.ts`:

```ts
// Weighted ambient idle picker. Pure: the stage feeds it Math.random.
export type IdleEntry = readonly [clip: string, weight: number, minSec: number, maxSec: number];

export const IDLE_POOL: readonly IdleEntry[] = [
  ["Idle", 8, 6, 12],
  ["Idle_2", 4, 5, 9],
  ["Eating", 3, 4, 8],
  ["Walk", 3, 3, 6],
];

export const FIRST_HOLD_MS = 4000;
const MS = 1000;

export function pickIdle(random: () => number = Math.random, pool: readonly IdleEntry[] = IDLE_POOL): { clip: string; holdMs: number } {
  const total = pool.reduce((sum, e) => sum + e[1], 0);
  let roll = random() * total;
  const last = pool.at(-1);
  if (!last) {
    throw new Error("Idle pool is empty.");
  }
  let chosen: IdleEntry = last;
  for (const entry of pool) {
    if (roll < entry[1]) {
      chosen = entry;
      break;
    }
    roll -= entry[1];
  }
  const [clip, , minSec, maxSec] = chosen;
  const holdMs = Math.round((minSec + random() * (maxSec - minSec)) * MS);
  return { clip, holdMs };
}
```

Run `npm test -- idle-scheduler`: pass.

- [ ] **Step 2: Mood context and the URL module**

`src/components/pup/pup-url.ts`:

```ts
export const PUP_URL = "/models/pup.glb";
```

`src/components/pup/pup-mood-context.tsx`:

```tsx
import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { Mood } from "@/lib/domain";
import type { PersistentMood } from "@/lib/mood";

export type TransientMood = "happy" | "party" | "proud" | "love";

interface MoodState {
  persistent: PersistentMood;
  transient: TransientMood | null;
  nonce: number;
}

type Action = { type: "trigger"; mood: TransientMood } | { type: "settle" } | { type: "persistent"; mood: PersistentMood };

function reducer(state: MoodState, action: Action): MoodState {
  switch (action.type) {
    case "trigger":
      return { ...state, transient: action.mood, nonce: state.nonce + 1 };
    case "settle":
      return state.transient ? { ...state, transient: null } : state;
    case "persistent":
      return state.persistent === action.mood ? state : { ...state, persistent: action.mood };
    default:
      return state;
  }
}

interface PupMoodValue {
  mood: Mood;
  nonce: number;
  persistent: PersistentMood;
  trigger: (mood: TransientMood) => void;
  settle: () => void;
  setPersistent: (mood: PersistentMood) => void;
}

const PupMoodContext = createContext<PupMoodValue | null>(null);

export function PupMoodProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { persistent: "idle", transient: null, nonce: 0 });
  const trigger = useCallback((mood: TransientMood) => dispatch({ type: "trigger", mood }), []);
  const settle = useCallback(() => dispatch({ type: "settle" }), []);
  const setPersistent = useCallback((mood: PersistentMood) => dispatch({ type: "persistent", mood }), []);
  const value = useMemo<PupMoodValue>(
    () => ({ mood: state.transient ?? state.persistent, nonce: state.nonce, persistent: state.persistent, trigger, settle, setPersistent }),
    [state, trigger, settle, setPersistent]
  );
  return <PupMoodContext.Provider value={value}>{children}</PupMoodContext.Provider>;
}

export function usePupMood(): PupMoodValue {
  const value = useContext(PupMoodContext);
  if (!value) {
    throw new Error("usePupMood must be used inside PupMoodProvider.");
  }
  return value;
}
```

Mount `<PupMoodProvider>` in `src/main.tsx` inside `<AuthProvider>`, wrapping `<RouterProvider />`.

- [ ] **Step 3: The model**

`src/components/pup/pup-model.tsx`:

```tsx
// Loads the GLB, frames it, drives the animation mixer from the mood context,
// and handles boop (tap) and turntable (drag). Only pup-stage imports this.
import { useAnimations, useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { type AnimationAction, Box3, type Group, LoopOnce, LoopRepeat, MathUtils, Mesh, Vector3 } from "three";
import { FIRST_HOLD_MS, pickIdle } from "./idle-scheduler";
import { usePupMood } from "./pup-mood-context";
import { PUP_URL } from "./pup-url";

const FADE = 0.35;
const FLOOR_Y = -1.0;
const TARGET_HEIGHT = 2.0;
const TURN_SPEED = 0.012;
const DRAG_THRESHOLD_PX = 2;
const DAMP = 6;
const MAX_DT = 0.05;
const SQUISH = 0.12;
const MIN_ONCE_MS = 400;
const SETTLE_EARLY_MS = 100;
const MS = 1000;

const CLIP_FOR_MOOD = {
  happy: "Gallop_Jump",
  party: "Gallop_Jump",
  proud: "Idle_HitReact_Left",
  love: "Idle_HitReact_Right",
  sleepy: "Idle_2_HeadLow",
  pout: "Idle_2_HeadLow",
} as const;

type Actions = Record<string, AnimationAction | null>;

/** Finds an action by clip name, tolerating an armature prefix like "Armature|Idle". */
function findAction(actions: Actions, name: string): AnimationAction | null {
  const exact = actions[name];
  if (exact) {
    return exact;
  }
  const key = Object.keys(actions).find((k) => k.endsWith(`|${name}`));
  return key ? (actions[key] ?? null) : null;
}

export default function PupModel({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(PUP_URL, false, true);
  const { actions, mixer } = useAnimations(animations, group);
  const invalidate = useThree((state) => state.invalidate);
  const { mood, nonce, settle, trigger } = usePupMood();
  const current = useRef<AnimationAction | null>(null);
  const yaw = useRef({ target: 0, value: 0 });
  const squish = useRef(0);
  const baseScale = useRef(1);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const idleTimer = useRef<number | null>(null);

  const meshes = useMemo(() => {
    const list: Mesh[] = [];
    scene.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        // The culling sphere is computed once at bind pose; a jumping pup would vanish.
        o.frustumCulled = false;
        list.push(o);
      }
    });
    return list;
  }, [scene]);

  // Frame once at identity so a recycled group never compounds a previous scale.
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) {
      return;
    }
    g.position.set(0, 0, 0);
    g.scale.setScalar(1);
    g.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const s = TARGET_HEIGHT / Math.max(size.x, size.y, size.z, 1e-6);
    baseScale.current = s;
    g.scale.setScalar(s);
    g.updateMatrixWorld(true);
    const framed = new Box3().setFromObject(scene);
    const center = framed.getCenter(new Vector3());
    g.position.set(-center.x, FLOOR_Y - framed.min.y, -center.z);
    invalidate();
  }, [scene, meshes, invalidate]);

  const play = useCallback(
    (name: string, once: boolean): AnimationAction | null => {
      const next = findAction(actions, name);
      if (!next) {
        return null;
      }
      const prev = current.current;
      if (prev === next) {
        // Same clip again: restart a one-shot, leave a loop alone. Never re-fade
        // (reset() + fadeIn() on the only weighted action pops to the bind pose).
        if (once) {
          next.reset().play();
        }
        return next;
      }
      if (prev) {
        prev.fadeOut(FADE);
      }
      next.reset();
      next.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Number.POSITIVE_INFINITY);
      next.clampWhenFinished = once;
      next.fadeIn(FADE).play();
      current.current = next;
      return next;
    },
    [actions]
  );

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }, []);

  const scheduleIdle = useCallback(
    (first: boolean) => {
      clearIdleTimer();
      const { clip, holdMs } = first ? { clip: "Idle", holdMs: FIRST_HOLD_MS } : pickIdle();
      play(clip, false);
      idleTimer.current = window.setTimeout(() => scheduleIdle(false), holdMs);
    },
    [clearIdleTimer, play]
  );

  // Mood -> clip. Transient moods play once and settle back to the persistent mood.
  // `nonce` is in the deps on purpose: the same mood re-triggers.
  useEffect(() => {
    if (reducedMotion) {
      // Bake Idle's first frame into the bones, then freeze.
      clearIdleTimer();
      mixer.stopAllAction();
      const idle = findAction(actions, "Idle");
      if (idle) {
        idle.reset().setEffectiveWeight(1).play();
        mixer.update(0);
        current.current = idle;
      }
      mixer.timeScale = 0;
      invalidate();
      return;
    }
    mixer.timeScale = 1;
    if (mood === "idle") {
      scheduleIdle(true);
      return clearIdleTimer;
    }
    if (mood === "sleepy" || mood === "pout") {
      clearIdleTimer();
      play(CLIP_FOR_MOOD[mood], false);
      return;
    }
    clearIdleTimer();
    const action = play(CLIP_FOR_MOOD[mood], true);
    const clipMs = action ? action.getClip().duration * MS : MIN_ONCE_MS;
    const id = window.setTimeout(settle, Math.max(clipMs - SETTLE_EARLY_MS, MIN_ONCE_MS));
    return () => window.clearTimeout(id);
  }, [mood, nonce, reducedMotion, mixer, actions, play, scheduleIdle, clearIdleTimer, settle, invalidate]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) {
      return;
    }
    const dt = Math.min(delta, MAX_DT);
    yaw.current.value = MathUtils.damp(yaw.current.value, yaw.current.target, DAMP, dt);
    g.rotation.y = yaw.current.value;
    squish.current = MathUtils.damp(squish.current, 0, DAMP, dt);
    const s = baseScale.current;
    const wide = s * (1 + SQUISH * 0.5 * squish.current);
    g.scale.set(wide, s * (1 - SQUISH * squish.current), wide);
  });

  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    drag.current = { x: e.clientX, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);
  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!drag.current) {
        return;
      }
      const dx = e.clientX - drag.current.x;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) {
        drag.current.moved = true;
        yaw.current.target += dx * TURN_SPEED;
        drag.current.x = e.clientX;
        if (reducedMotion) {
          // Demand frameloop: no damping frames will follow, so snap.
          yaw.current.value = yaw.current.target;
        }
        invalidate();
      }
    },
    [reducedMotion, invalidate]
  );
  const onPointerUp = useCallback(() => {
    if (drag.current && !drag.current.moved && !reducedMotion) {
      squish.current = 1;
      trigger("happy");
    }
    drag.current = null;
  }, [reducedMotion, trigger]);

  return (
    <group onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} ref={group}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(PUP_URL, false, true);
```

Verified against these versions earlier: `useGLTF(url, false, true)` never instantiates the Draco loader (no CDN fetch) and decodes meshopt with the WASM inlined in `three-stdlib`; `useAnimations` returns `actions` typed `Record<string, AnimationAction | null>`; R3F's `setPointerCapture` shim captures on the canvas. `frustumCulled = false` is required, not cosmetic.

- [ ] **Step 4: The stage and the lazy wrapper**

`src/components/pup/pup-stage.tsx` (`PCFSoftShadowMap` was removed in three 0.186; PCF with a `radius` gives the soft look). `touchAction: "pan-y"` keeps vertical page scrolling on a phone while horizontal drags turn the pup:

```tsx
// Imports three and R3F. Only pup.tsx imports this, lazily.
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { PCFShadowMap, PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import PupModel from "./pup-model";

const ENV_INTENSITY = 1.2;
const ENV_BLUR = 0.04;
const KEY_INTENSITY = 1.75;
const FILL_INTENSITY = 0.4;
const SHADOW_MAP = 2048;
const SHADOW_RADIUS = 4;
const SHADOW_BIAS = -0.0005;
const FLOOR_Y = -1.0;

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const { texture } = pmrem.fromScene(room, ENV_BLUR);
    scene.environment = texture;
    scene.environmentIntensity = ENV_INTENSITY;
    return () => {
      scene.environment = null;
      texture.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Placeholder() {
  return (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[0.6, 24, 24]} />
      <meshStandardMaterial color="#e9c9b6" roughness={0.9} />
    </mesh>
  );
}

export default function PupStage({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0.9, 4.2], fov: 32 }}
      dpr={[1, 2]}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      shadows={{ type: PCFShadowMap }}
      style={{ touchAction: "pan-y" }}
    >
      <Environment />
      <directionalLight
        castShadow
        color="#fff1e6"
        intensity={KEY_INTENSITY}
        position={[3, 5, 2]}
        shadow-bias={SHADOW_BIAS}
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-radius={SHADOW_RADIUS}
      />
      <directionalLight color="#ffe4f0" intensity={FILL_INTENSITY} position={[-3, 2, -2]} />
      <mesh position={[0, FLOOR_Y, 0]} receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[12, 12]} />
        <shadowMaterial opacity={0.25} transparent />
      </mesh>
      <Suspense fallback={<Placeholder />}>
        <PupModel reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}
```

`src/components/pup/pup.tsx`. The class is the one place React still needs one (error boundaries). The stage is `lazy`, so three.js is its own chunk and the landing/login bundles stay small:

```tsx
import { Dog } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Component, lazy, type ReactNode, Suspense } from "react";
import { cn } from "@/lib/utils";

const PupStage = lazy(() => import("./pup-stage"));

interface BoundaryState {
  failed: boolean;
}

class StageBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Skeleton() {
  return <div className="h-full w-full animate-pulse rounded-3xl bg-muted" />;
}

function Resting({ name }: { name: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
      <Dog aria-hidden="true" className="size-12" />
      <p className="m-0">{name} is napping (3D isn't available here).</p>
    </div>
  );
}

export default function Pup({ name, className }: { name: string; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <div aria-label={`${name}, your pup`} className={cn("relative h-[300px] w-full sm:h-[380px]", className)} role="group">
      <StageBoundary fallback={<Resting name={name} />}>
        <Suspense fallback={<Skeleton />}>
          <PupStage reducedMotion={reduced} />
        </Suspense>
      </StageBoundary>
    </div>
  );
}
```

Tab hidden: R3F pauses its loop when the canvas is not visible (it uses `requestAnimationFrame`, which browsers throttle to zero in background tabs), so no extra `visibilitychange` handling is needed.

- [ ] **Step 5: Mount on the Den and preload the model**

In `src/pages/den.tsx` replace the `#pup-stage-slot` block with:

```tsx
      <div className="island-shell mb-6 overflow-hidden p-2 sm:p-4">
        <Pup name={pup} />
        <p className="m-0 pb-2 text-center text-muted-foreground text-xs">Tap {pup} for a boop, drag to turn them around.</p>
      </div>
```

(import `Pup` from `@/components/pup/pup`). In `index.html` add, after the font link: `<link rel="preload" href="/models/pup.glb" as="fetch" crossorigin="anonymous" />` so the GLB download starts with the shell rather than after the lazy chunk. (The Workbox runtime cache keeps it for later visits.)

- [ ] **Step 6: Verify**

`npm run fix && npm run check && npm test`, then `npm run build` and check the chunking: `ls -la dist/assets | sort -k5 -n | tail -5` shows one large chunk (three + R3F + drei, ~900 KB before gzip) separate from the entry, and `grep -l "WebGLRenderer" dist/assets/index-*.js` prints nothing (the entry bundle is three-free). Browser on the Den: the pup appears within ~2s, idle cycles change every few seconds, drag turns it, tap makes it jump, tapping again mid-jump restarts the jump without a flicker. Network tab: `pup.glb` loads once (preloaded), no requests to gstatic or other CDNs besides Google Fonts. Enable "reduce motion" in the OS → frozen on the Idle pose, drag still turns it. Block WebGL (Chrome `--disable-gpu` or DevTools "Emulate WebGL unavailable") → the "napping" fallback, page still works. On a phone-width viewport, vertical swipes on the canvas still scroll the page.

- [ ] **Step 7: Commit**

```bash
git add src index.html
git commit -m "Add the 3D pup stage with idle behaviour, boop and turntable

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Wire moods to the app, confetti, sleepy and pout

**Files:**
- Create: `src/components/pup/confetti.tsx`
- Modify: `src/pages/den.tsx`, `src/pages/timeline.tsx`

**Interfaces:**
- Consumes: `usePupMood`, `derivePersistentMood`, `computeProgress`, `usePartnerActivity`.
- Produces: `<Confetti burst={number} />` (fires a burst whenever `burst` increments).

- [ ] **Step 1: Confetti**

`src/components/pup/confetti.tsx`:

```tsx
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

const COUNT = 90;
const DURATION_MS = 1200;
const GRAVITY = 1800;
const COLORS = ["#be185d", "#ec4899", "#f9a8d4", "#0d9488", "#fbbf24", "#818cf8"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  w: number;
  h: number;
}

export default function Confetti({ burst }: { burst: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = canvas.current;
    if (burst === 0 || reduced || !el) {
      return;
    }
    const ctx = el.getContext("2d");
    if (!ctx) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = el.clientWidth * dpr;
    el.height = el.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = el.clientWidth;
    const h = el.clientHeight;
    const particles: Particle[] = Array.from({ length: COUNT }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = 500 + Math.random() * 500;
      return {
        x: w / 2,
        y: h * 0.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#be185d",
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
      };
    });
    let start = 0;
    let last = 0;
    let frame = 0;
    const step = (t: number) => {
      if (!start) {
        start = t;
        last = t;
      }
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      ctx.clearRect(0, 0, w, h);
      const alpha = 1 - (t - start) / DURATION_MS;
      for (const p of particles) {
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t - start < DURATION_MS) {
        frame = requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [burst, reduced]);
  return <canvas className="pointer-events-none absolute inset-0 h-full w-full" ref={canvas} role="presentation" />;
}
```

- [ ] **Step 2: Wire the Den**

In `src/pages/den.tsx` import `useEffect`, `derivePersistentMood` from `@/lib/mood`, `usePupMood` from `@/components/pup/pup-mood-context`, and inside `DenContent` replace `const habitToggle = useHabitToggle(ctx);` and the `onHeart` callback with:

```tsx
  const { trigger, setPersistent } = usePupMood();
  const onStamped = useCallback(() => trigger("happy"), [trigger]);
  const habitToggle = useHabitToggle(ctx, onStamped);

  // Persistent mood from the couple's activity and the local clock; re-derived
  // every minute so "evening" flips without waiting for a fetch.
  useEffect(() => {
    const derive = () =>
      setPersistent(derivePersistentMood({ lastCheckInAt: view.lastCheckInAt, todayCount: view.todayCount, now: new Date() }));
    derive();
    const id = window.setInterval(derive, 60_000);
    return () => window.clearInterval(id);
  }, [view.lastCheckInAt, view.todayCount, setPersistent]);

  const onHeart = useCallback(() => {
    toast("Your partner sent you a heart");
    trigger("love");
  }, [trigger]);
```

The Den has no milestone stamping, so it mounts no confetti.

- [ ] **Step 3: Wire the Timeline**

In `src/pages/timeline.tsx` import `usePupMood`, `Confetti` from `@/components/pup/confetti`, `Pup` from `@/components/pup/pup`, `isSealed` from `@/lib/domain`, `computeProgress` from `@/lib/ladder`, `toLite` from `@/lib/views`, and inside `TimelinePage` (above the early returns):

```tsx
  const { trigger } = usePupMood();
  const [burst, setBurst] = useState(0);
  const pupName = data?.couple.pupName ?? "your pup";
  const onStamped = useCallback(() => trigger("happy"), [trigger]);
  const habitToggle = useHabitToggle(ctx, onStamped);
```

(replacing the plain `useHabitToggle(ctx)` call). Then change two handlers:

- `stampMilestone`: compute completion before and after with the pure maths, since the database does not report it:

```tsx
  const stampMilestone = useCallback(
    (goal: Goal) =>
      runGoalAction(goal, async () => {
        if (!data) {
          return;
        }
        const active = data.goals.filter((g) => g.archivedAt === null);
        const lite = toLite(data);
        const before = computeProgress(active, lite, today)[goal.id]?.complete ?? false;
        const day = localDayKey();
        const { created } = await stamp({ coupleId: me.couple.id, goalId: goal.id, uid: me.userId, day });
        if (!created) {
          return;
        }
        const after = computeProgress(active, [...lite, { goalId: goal.id, uid: me.userId, day }], today)[goal.id]?.complete ?? false;
        if (after && !before && (goal.horizon === "quarter" || goal.horizon === "year")) {
          trigger("proud");
        } else if (after && !before) {
          trigger("party");
          setBurst((b) => b + 1);
        } else {
          trigger("happy");
        }
      }),
    [runGoalAction, data, today, me.couple.id, me.userId, trigger]
  );
```

- `seal`: after `await refresh()`, the fresh data tells whether both waxes are down:

```tsx
  const seal = useCallback(
    async (goal: Goal) => {
      await sealGoal(goal.id, me.userId, me.couple.id);
      const fresh = await refresh();
      const updated = fresh?.goals.find((g) => g.id === goal.id);
      if (updated && isSealed(updated, (fresh?.members ?? []).map((m) => m.id))) {
        trigger("party");
        setBurst((b) => b + 1);
      }
    },
    [me.userId, me.couple.id, refresh, trigger]
  );
```

Mount a compact pup above the tabs (after the heading block): `<div className="island-shell relative mb-6 overflow-hidden p-2"><Pup className="h-[200px] sm:h-[240px]" name={pupName} /><Confetti burst={burst} /></div>`.

- [ ] **Step 4: Verify**

Browser: stamp a habit → the pup jumps. Fill a month goal → jump + confetti. Fill a quarter goal → chest-pop "proud". Partner hearts you → within a second the pup does the head tilt. Set the OS clock past 20:00 (or temporarily lower `SLEEPY_HOUR` locally, then revert) with no stamps today → head-low nap; boop → jump then back to nap. Reduced motion: no confetti, no clip changes. On a 375 px viewport the Timeline pup is 200 px tall and the page still scrolls.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "Wire pup moods to check-ins, seals, hearts and quiet evenings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Stage 6: Polish and ship

### Task 13: Landing page with Hallmark, copy pass, accessibility and the mobile sweep

**Files:**
- Modify: `src/pages/landing.tsx`, `src/styles.css` (only if Hallmark adds tokens), `src/components/app-shell.tsx` (copy), any page copy

**Interfaces:**
- Consumes: `Pup`, `Button`, the token block in `src/styles.css`.

- [ ] **Step 1: Design the landing page with Hallmark**

Read `.claude/skills/hallmark/SKILL.md` and follow its default Design flow (the `hallmark` skill may not be invocable until the session reloads; reading the file and its `references/` is the documented fallback). Give it this brief:

> Landing page for CoupleGoal, a web app for exactly two people, a couple, to keep daily habits and monthly/quarterly/yearly goals together, with a realistic animated 3D bulldog puppy that cheers every paw print. Audience: couples on their phones. The one action: "Sign in" (and "Join with a code" for the invited partner). Tone: warm, cosy, playful, never saccharine; first-person plural. Constraints: use the existing token block in `src/styles.css` (rose palette, Fredoka/Nunito) and do not introduce new colours or fonts; the hero must contain the live `<Pup name="Your pup" />` component; no fabricated metrics, testimonials or logos; no italic headings; Lucide icons only; every width from 320 to 1280 with no sideways scroll. Files: rewrite `src/pages/landing.tsx` only; add tokens to `src/styles.css` only if Hallmark names one that is missing.

Hallmark's pre-emit self-critique scores go in a comment at the top of `landing.tsx`. If Hallmark proposes a section that needs content the product does not have (a stats bar, a logo wall), drop the section rather than invent content. Mount `<Pup name="Your pup" />` in the hero inside an `island-shell` (import from `@/components/pup/pup`); the model preload link from Task 11 already covers the landing route.

- [ ] **Step 2: Copy pass**

Read every user-facing string in `src/pages/` and `src/components/` against the rules: warm, first-person plural, in the pup's voice, no guilt, no "failed". Empty states read as invitations. No emoji in UI chrome (the only emoji are user charms and the charm input placeholder). The sign-out button has an accessible label; the tab bar has `aria-label="Main"`.

- [ ] **Step 3: Accessibility and theme pass**

With the Playwright MCP on `/`, `/login`, `/pair`, `/den`, `/goals`, `/us`:
- Keyboard: Tab reaches every control, focus rings visible (ring token), Escape closes dialogs and menus.
- Contrast: run `axe` via `browser_run_code_unsafe` (`await import("https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js"); return (await axe.run()).violations`) in light and dark; zero `serious`/`critical` violations. Fix any by adjusting classes, not tokens.
- Dark mode: every page, no white flashes, the pup stage floor shadow still reads.
- Reduced motion: no confetti, pup frozen, dialogs fade.

- [ ] **Step 4: The mobile sweep (Rule 1, all screens)**

For each of `/`, `/login`, `/pair`, `/den`, `/goals` (Day and Month tabs, the New goal dialog open), `/us`: resize to 320, 375, 768, 1280 and evaluate `document.documentElement.scrollWidth > document.documentElement.clientWidth` → must be `false`. Take a 375 and a 1280 screenshot of each and look at them: no clipped text, no overlapping controls, tap targets ≥ 44 px, dialog is a bottom sheet at 375, bottom tab bar present at 375 and absent at 1280, nothing hidden under the tab bar (scroll to the bottom of the Den). Fix what fails, re-run. Record the result in the commit message body ("Mobile sweep: 6 screens × 4 widths, no horizontal scroll").

- [ ] **Step 5: Check and commit**

```bash
npm run fix && npm run check && npm test && npm run build
git add src
git commit -m "Design the landing page, polish copy, pass a11y and the mobile sweep

Mobile sweep: 6 screens × 4 widths (320/375/768/1280), no horizontal scroll.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Keep-alive function, Vercel deploy, iPhone install check, docs, hand-off

**Files:**
- Create: `api/keepalive.ts`, `README.md`, `CLAUDE.md`
- Modify: nothing else (Vercel config was written in Task 1)

**Interfaces:**
- Produces: `GET /api/keepalive` → `{ ok: true, rows: 1 }`; a production URL on `*.vercel.app`; env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel project (production + preview).

- [ ] **Step 1: The keep-alive function**

`api/keepalive.ts` (Vercel Node function; runs from `vercel.json` `crons` every third day at 03:00 UTC, which Hobby allows). It uses the same public values as the frontend, so nothing secret is involved:

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Supabase pauses free projects after 7 idle days. One REST read every few days
// counts as activity. Public values only: the publishable key and the URL.
export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!(url && key)) {
    res.status(500).json({ ok: false, error: "Supabase env vars are not set on this deployment." });
    return;
  }
  const upstream = await fetch(`${url}/rest/v1/keepalive?select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const rows = (await upstream.json()) as unknown[];
  res.status(upstream.ok ? 200 : 502).json({ ok: upstream.ok, rows: Array.isArray(rows) ? rows.length : 0 });
}
```

`tsconfig.app.json` already includes `api`. `npm run check` must pass.

- [ ] **Step 2: Secrets audit, then link the Vercel project**

```bash
python3 "/Users/johnnynguyen/Software/mvp-stack-plugin/skills/mvp-stack/scripts/audit_secrets.py" .
vercel whoami
vercel link --yes --project couplegoal
```

Expected: audit exits 0; `whoami` prints the user's Vercel login (they logged in earlier; if not, ask them to run `! vercel login`); `link` creates `.vercel/` (git-ignored) and the project `couplegoal` under their personal scope. Hobby is fine: the user confirmed personal, non-commercial use.

- [ ] **Step 3: Environment variables on Vercel**

Both values are public (they are in the browser bundle by design), so they can be added from the values returned by the Supabase MCP in Task 3:

```bash
printf '%s' '<url>' | vercel env add VITE_SUPABASE_URL production
printf '%s' '<url>' | vercel env add VITE_SUPABASE_URL preview
printf '%s' '<sb_publishable_...>' | vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
printf '%s' '<sb_publishable_...>' | vercel env add VITE_SUPABASE_PUBLISHABLE_KEY preview
vercel env ls
```

Expected: `env ls` lists both names for `production` and `preview`. No other variables are needed. Never add a `sb_secret_` key to this project.

- [ ] **Step 4: Preview deploy and verify**

```bash
vercel
```

Expected: a preview URL. On it, with the Playwright MCP: `/` loads with the pup; `/login` → sign in as dev-a → `/den` shows the den created in development (same Supabase project); `/manifest.webmanifest` is served with the icons; `/api/keepalive` returns `{"ok":true,"rows":1}`; DevTools → Application → Service Workers shows `sw.js` activated; `/models/pup.glb` response has `cache-control: public, max-age=31536000, immutable`. Repeat the 375 px scroll-width check on `/den` and `/goals` on the preview URL (fonts and the model behave differently once served for real).

- [ ] **Step 5: Production deploy (ask first)**

Ask with `AskUserQuestion`: "Deploy CoupleGoal to production on Vercel now? This creates the public URL `https://couplegoal-<hash>.vercel.app` (Hobby, personal use)." On yes:

```bash
vercel --prod
```

Then re-run the `/api/keepalive` and `/manifest.webmanifest` checks on the production URL. Vercel schedules the cron on production deployments only; confirm it appears under the project's Settings → Cron Jobs (the user can open the dashboard, or `vercel crons ls` if the installed CLI has it).

- [ ] **Step 6: Install on iPhone (user)**

Ask the user to open the production URL in Safari on their iPhone and check: the page has no sideways scroll; the "Keep us on your Home Screen" card appears on the Den; Share → Add to Home Screen → the icon is the rose paw and the name "CoupleGoal"; launching from the Home Screen opens full-screen without Safari chrome, the status bar area is rose, the bottom tab bar sits above the home indicator; signing in persists after closing and reopening the app; a habit stamped on the phone appears on the laptop within a second. If they cannot test now, say plainly in the hand-off that the iPhone install is unverified.

- [ ] **Step 7: README and CLAUDE.md**

`README.md`:

```markdown
# CoupleGoal

Small taps, big dreams, one pup. A goals app for exactly two people: daily habits, monthly / quarterly / yearly milestones that climb toward each other, share-code pairing, and a realistic animated 3D bulldog puppy that cheers every paw print. Installable on iPhone as a PWA.

Spec: `docs/superpowers/specs/2026-09-17-timelinegoal-web-design.md`. Plan: `docs/superpowers/plans/2026-09-18-couplegoal-supabase-pwa.md`.

## Stack

- Vite 7 + React 19 + TypeScript, React Router, Tailwind 4, `motion`, three.js via React Three Fiber.
- Supabase (Postgres + Auth + Realtime) in `ap-southeast-2`. Row-level security on every table; invariants in triggers; pairing via `security definer` RPCs. Migrations in `supabase/migrations/`.
- Vercel (static build + one cron function). PWA via `vite-plugin-pwa`.

## Develop

    nvm use            # Node 22
    npm install
    cp .env.example .env.local   # fill in the two public Supabase values
    npm run dev        # http://localhost:5173
    npm run check      # Biome + tsc
    npm test           # Vitest (pure modules)
    node --env-file=.env.local scripts/rls-probe.mjs   # signed-out RLS probe

Two accounts are needed to try pairing: sign up twice (any email; confirmations are off) in two browser profiles.

## Supabase

- Project `couplegoal`, region `ap-southeast-2`. Auth: email + password with **Confirm email off** (Authentication → Sign In / Providers → Email). Magic links would open in Safari rather than the installed app, so there are none.
- Schema changes: add a numbered file to `supabase/migrations/`, apply it (Supabase MCP `apply_migration`, or `npx supabase link` + `npx supabase db push`), regenerate `src/lib/database.types.ts`, run the RLS probe.
- The publishable key ships in the browser on purpose; RLS is what protects rows. Never put a `sb_secret_` / `service_role` key in this repo, in `.env.local`, or on Vercel: nothing here needs one.

## Deploy

`vercel` for a preview, `vercel --prod` for production. Env vars on the project: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (production and preview). `vercel.json` rewrites every route to `index.html`, caches `/models/*` for a year, and schedules `/api/keepalive` every third day.

## Free tiers and what happens at the caps (checked Sep 2026)

| Service | Free | First thing that breaks | Then |
| --- | --- | --- | --- |
| Supabase | 500 MB DB, 50k monthly users, 2 projects, no card | 7 idle days pauses the project (the cron prevents it; if it pauses anyway, restore it from the dashboard) | Pro $25/mo |
| Vercel Hobby | 100 GB transfer, non-commercial only | Charging money, ads or donations breaks the terms; move the static build to Cloudflare Pages (same `dist/`) | Pro $20/mo |

## The pup

`public/models/pup.glb` (credits in `public/models/LICENSE.md`): "Bulldog Puppy" by doinspire, CC BY 4.0; skeleton and animations by Quaternius, CC0. Regenerate from a new source with `npx @gltf-transform/cli optimize source.glb public/models/pup.glb --compress meshopt --texture-compress webp --texture-size 1024`, then bump the filename and `PUP_URL`.
```

`CLAUDE.md`:

```markdown
# CoupleGoal

Vite + React SPA on Supabase and Vercel. Node 22 (`nvm use`), npm. `npm run fix && npm run check && npm test` before every commit.

- Domain types in `src/lib/domain.ts`; rows are mapped once in `src/data/mappers.ts`. Pure maths (`periods`, `ladder`, `mood`, `views`) never import Supabase.
- One fetch per couple (`fetchCoupleData`), kept fresh by Realtime + SWR in `src/data/use-couple-data.ts`. Pages derive `denView` / `timelineView` from it.
- Every write is a function in `src/data/mutations.ts`; errors are already user-facing copy (raised by triggers/RPCs in `supabase/migrations/`).
- Rule 0: never read `.env.local`; never add a `sb_secret_` key anywhere. Rule 1: mobile-first, verify at 320/375/768/1280 before claiming a screen works.
- UI primitives in `src/components/ui/` are ours (hand-written Radix wrappers); tokens live in `src/styles.css` only.
- The pup (`src/components/pup/`) is lazy-loaded; never import `pup-stage` or `pup-model` outside that folder. `noUnknownAttribute` is off there for R3F props.
```

- [ ] **Step 8: Final verification and commit**

```bash
npm run fix && npm run check && npm test && npm run build
node --env-file=.env.local scripts/rls-probe.mjs
python3 "/Users/johnnynguyen/Software/mvp-stack-plugin/skills/mvp-stack/scripts/audit_secrets.py" .
git add api README.md CLAUDE.md
git commit -m "Add keep-alive cron, deploy config docs and project guide

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 9: Hand-off (plain language, in the final message)**

- The public URL, that anyone with the link can open it but only signed-in members see their den, and how to add a partner (share the 6-character code from the Den or Us page).
- What it costs today: $0. The first thing that would change that: charging money (Vercel Hobby is non-commercial; the static build moves to Cloudflare Pages in one step), or a week of nobody using it before the cron ever ran (Supabase pause; restore from the dashboard).
- What is real vs stubbed: everything is real; no push notifications, no photos, no "leave den" (spec's out-of-scope list).
- What was verified: local + preview + production checks, the mobile sweep, and whether the iPhone install was tried by the user or is unverified.
- How to change something tomorrow: open `~/Software/Projects/CoupleGoal` in Claude Code and say what you want different.

---

## Self-review notes

- **Spec coverage:** pages (1, 4, 5, 7, 8, 9, 13), goals model, periods and the ±1 day rule (2, 3), ladder maths (2, 9), seal incl. the Den's "waiting for your paw" (3, 8, 9), pairing atomicity and share codes (3, 5), Den "waiting for your partner" (8), partner liveness by Realtime with polling fallback (6, 8), optimistic paws with error toasts (6, 7), milestone undo and edit (9), pup stage, moods, boop/turn, reduced motion, load fallback, no CDN (10, 11, 12), theme and motion tokens (1), credits (5, 10, 14), database error panel (1, 4), testing (2, 3, 6, 8, 11), deploy and cache headers (1, 14). Added beyond the spec: PWA manifest/SW/icons/iOS meta (1), bottom tab bar and safe areas (1), bottom-sheet dialogs (1), install hint (8), keep-alive cron (14), signed-out RLS probe (3).
- **Stack-specific decisions worth knowing:** `sealGoal`, `sendHeart` and `stamp` send `couple_id`/`horizon` that the `before insert` triggers overwrite from the goal or check-in, and RLS `with check` sees the trigger's values. Milestone "full" counts every stamp on the goal within its period (both partners on a shared goal). Habit undo honours the same ±1 day grace as stamping. Memories older than the current year show titles without paws (the fetch starts at 1 January of the viewed year's `today`). Vercel Hobby cron runs at most daily; the schedule here is every third day.
- **Type consistency:** `sealGoal(goalId, uid, coupleId)` and `sendHeart({ checkinId, uid, coupleId })` everywhere; `useHabitToggle(ctx: { coupleId, me, refresh }, onStamped?)`; `useCoupleData(coupleId, today)` returns `{ data, error, refresh }` where `refresh()` resolves to the fresh `CoupleData`; `denView(data, me, today)` / `timelineView(data, me, today)`; `NewGoalDialog` takes `ctx: { coupleId, uid, today }`; `Pup` props are `{ name, className? }`; `useDen()` gives `{ me: Me & { couple: Couple }, refresh }`.
- **Verified against installed versions before writing:** three 0.186 (no `PCFSoftShadowMap`, `RoomEnvironment` present), drei 10.7.8 `useGLTF(url, false, true)` fetches no CDN decoder, the GLB compresses to ~642 KB with all 12 clips. Pinned to previous majors on purpose: Vite 7, React Router 7, TypeScript 5.9, Vitest 4; the newest majors (Vite 8, React Router 8, TypeScript 7) shipped after this plan's knowledge and are not needed.
