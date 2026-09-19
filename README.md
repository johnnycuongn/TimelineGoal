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

- Project `couplegoal` (ref `uosxptayqdetgbyercqt`), region `ap-southeast-2`. Migrations `0001`–`0006` are applied to it; `0006` is the security-advisor hardening. Auth: email + password with **Confirm email off** (Authentication → Sign In / Providers → Email). Magic links would open in Safari rather than the installed app, so there are none.
- Schema changes: add a numbered file to `supabase/migrations/`, apply it (Supabase MCP `apply_migration`, or `npx supabase link` + `npx supabase db push`), regenerate `src/lib/database.types.ts`, run the RLS probe.
- The publishable key ships in the browser on purpose; RLS is what protects rows. Never put a `sb_secret_` / `service_role` key in this repo, in `.env.local`, or on Vercel: nothing here needs one.

## Deploy

    vercel deploy --target=preview   # a preview URL; nothing becomes public
    vercel --prod                    # the public production URL

Deploying is the owner's decision, so prefer the explicit target over a bare `vercel`. On
a **brand-new** Vercel project there is nothing to preview against and the CLI promotes
the first deployment to production on its own — *"this is the project's first deployment,
so it was assigned to production"* — which publishes the URL and starts the cron. Treat
the first deployment of a fresh project as going public, whatever the command looks like.
After that, `vercel` with no target is a preview.

Env vars on the project: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (production
and preview) and `CRON_SECRET` (production). `CRON_SECRET` is what `/api/keepalive` checks
the `Authorization: Bearer …` header against — Vercel Cron sends it on its own, and without
it the endpoint returns 500 rather than pinging Supabase. Generate it without ever printing
it: `openssl rand -hex 32 | vercel env add CRON_SECRET production`; `vercel env ls` lists
the names. `vercel.json` rewrites every route to `index.html`, caches `/models/*` for a
year, and schedules `/api/keepalive` every third day. Cron jobs are attached to production
deployments only, so a preview never pings Supabase; `vercel crons ls` shows the schedule.

The project is linked as `couplegoal` under the owner's personal scope (`vercel ls
couplegoal` for its URLs). `vercel remove couplegoal` deletes the project and with it the
public URL and the cron.

## Free tiers and what happens at the caps (checked Sep 2026)

| Service | Free | First thing that breaks | Then |
| --- | --- | --- | --- |
| Supabase | 500 MB DB, 50k monthly users, 2 projects, no card | 7 idle days pauses the project (the cron prevents it; if it pauses anyway, restore it from the dashboard) | Pro $25/mo |
| Vercel Hobby | 100 GB transfer, non-commercial only | Charging money, ads or donations breaks the terms; move the static build to Cloudflare Pages (same `dist/`) | Pro $20/mo |

## The pup

`public/models/pup.glb` (credits in `public/models/LICENSE.md`): "Bulldog Puppy" by doinspire, CC BY 4.0; skeleton and animations by Quaternius, CC0. Regenerate from a new source with `npx @gltf-transform/cli optimize source.glb public/models/pup.glb --compress meshopt --texture-compress webp --texture-size 1024`, then bump the filename and `PUP_URL`.
