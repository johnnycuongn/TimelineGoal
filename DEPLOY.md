# Deploying CoupleGoal

How to get a change from this folder onto https://couplegoal-navy.vercel.app.
Read "What is already set up" once; after that the everyday deploy is the
five commands under "Deploy a change".

## What is already set up

These exist and do not need to be created again. If you are on a new machine,
you only need to *log in* to them (see "Prerequisites").

| Piece | Where | Notes |
| --- | --- | --- |
| Code | GitHub `johnnycuongn/CoupleGoal` (private), branch `main` | The local folder tracks `origin/main`. GitHub is a backup only; **pushing does not deploy**. |
| Hosting | Vercel project `couplegoal`, personal scope, Hobby plan | Production alias `couplegoal-navy.vercel.app`. Linked from this folder via the git-ignored `.vercel/` directory. |
| Env vars on Vercel | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (production + preview), `CRON_SECRET` (production) | `vercel env ls` shows names only. The two `VITE_` values are public by design; `CRON_SECRET` is the only secret and only Vercel's scheduler ever holds it. |
| Cron | `vercel.json` → `/api/keepalive` every third day at 03:00 UTC | Pings Supabase so the free project never pauses for inactivity. Attached to production deploys only. |
| Database + auth | Supabase project `couplegoal`, ref `uosxptayqdetgbyercqt`, region `ap-southeast-2` | Migrations `0001`–`0007` in `supabase/migrations/` are applied. Email + password sign-in with "Confirm email" off. |
| Local env | `.env.local` (git-ignored) | Holds the same two `VITE_` values as Vercel. Copy from `.env.example` if it is missing; get the values from Supabase → Project Settings → API. |

Nothing in this project needs a Supabase `service_role` / `sb_secret_` key. Never add one anywhere.

## Prerequisites (per machine)

1. **Node 22** via nvm. From the project folder run `nvm use` (reads `.nvmrc`).
   If the shell cannot find `nvm`, this works too:

       export PATH="$HOME/.nvm/versions/node/v22.12.0/bin:$PATH"

2. **Dependencies.** `npm install`. If npm 10 crashes with an `edgesOut` error on
   this dependency set, install with `npx -y npm@11 install` instead.
3. **Vercel CLI, logged in.** `npx vercel whoami` should print your username.
   If not, run `npx vercel login` (opens a browser; pick the same account that owns
   the `couplegoal` project). Then, only if `.vercel/` is missing in this folder,
   run `npx vercel link` and choose the existing `couplegoal` project.
   `vercel link` sometimes appends `.env*` to `.gitignore`; it is already covered,
   so revert that line if it appears.
4. **GitHub CLI, logged in** (only for pushing): `gh auth status`. If not logged in,
   `gh auth login`.
5. **`.env.local`** present with the two `VITE_` values (see the table above).

## Deploy a change

Run from `~/Software/Projects/CoupleGoal`:

    npm run check     # Biome lint + TypeScript. Must be clean.
    npm test          # Vitest. Must be green.
    npm run build     # Same build Vercel runs. Must finish with "files generated".
    git add <the files you changed>
    git commit -m "What changed and why"
    git push          # backup to GitHub; does not deploy
    npx vercel --prod --yes   # builds and publishes to couplegoal-navy.vercel.app

`vercel --prod` prints a unique deployment URL and then `Aliased https://couplegoal-navy.vercel.app`.
The public address updates within a few seconds.

To see a change before publishing it, run `npx vercel` (no `--prod`). That gives a
private preview URL, does not touch the public site, and never runs the cron.

Commit with explicit file paths, never `git add -A`, so a stray local file can never
ride along.

## Verify after deploying

    curl -s -o /dev/null -w "%{http_code}\n" https://couplegoal-navy.vercel.app/            # 200
    curl -s -o /dev/null -w "%{http_code}\n" https://couplegoal-navy.vercel.app/api/keepalive  # 401 (correct: no secret sent)
    npx vercel inspect https://couplegoal-navy.vercel.app   # status ● Ready
    npx vercel crons ls                                      # shows /api/keepalive 0 3 */3 * *

Then open the site on your phone. An already-installed copy may show the previous
version once; close it fully and reopen to pick up the new service worker.

## Changing the database

Schema changes go through numbered SQL files, never through hand edits in the dashboard:

1. Add `supabase/migrations/0008_<name>.sql` (next free number).
2. Apply it to the live project. Either the Supabase MCP `apply_migration` tool from
   Claude Code, or the CLI: `npx supabase login`, `npx supabase link --project-ref uosxptayqdetgbyercqt`,
   `npx supabase db push`.
3. Regenerate the types: `npx supabase gen types typescript --project-id uosxptayqdetgbyercqt > src/lib/database.types.ts`.
4. Check row-level security still holds: `node --env-file=.env.local scripts/rls-probe.mjs` must exit 0.
5. Commit the migration and the types together, then deploy as above.

Apply the migration **before** deploying code that depends on it, so the live app never
runs ahead of its schema.

## Rolling back

Vercel keeps every deployment. `npx vercel ls couplegoal` lists them; copy the URL of
the last good one and run `npx vercel promote <that-url>`. The public alias moves back
instantly with no rebuild. Database migrations are not automatically reversible; write a
new migration that undoes the change.

## When something goes wrong

- **Build fails on Vercel but passes locally.** Vercel uses the Node version from
  `package.json` `engines` (22). Run `npm run build` locally first; it is the same command.
- **"Not for you" or 401 from `/api/keepalive` in the browser.** Expected. Only Vercel's
  cron, which sends `CRON_SECRET`, gets through.
- **500 from `/api/keepalive` in the Vercel function logs.** `CRON_SECRET` is missing on
  production. Regenerate it without ever printing it:
  `openssl rand -hex 32 | npx vercel env add CRON_SECRET production`, then redeploy.
- **Supabase project paused.** Restore it from the Supabase dashboard (Project → Restore).
  Check `npx vercel crons ls` and the function logs to see why the keep-alive stopped.
- **`vercel` deployed to production when you meant a preview.** This only happens on a
  brand-new Vercel project's first deployment. On this project a bare `npx vercel` is a
  preview.

## Free-tier limits

See the "Free tiers" table in `README.md`. Short version: everything is free today.
Charging money, showing ads or taking donations would break Vercel Hobby's terms; the
static build moves to Cloudflare Pages unchanged if that day comes.
