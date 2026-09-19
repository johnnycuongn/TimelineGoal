# Deploying CoupleGoal

How to get a change from this folder onto https://couplegoal-navy.vercel.app.
Read "What is already set up" once; after that the everyday deploy is the
five commands under "Deploy a change", or a tag if you let GitHub Actions
publish for you.

## What is already set up

These exist and do not need to be created again. If you are on a new machine,
you only need to *log in* to them (see "Prerequisites").

| Piece | Where | Notes |
| --- | --- | --- |
| Code | GitHub `johnnycuongn/TimelineGoal` (public), branch `web` | Same repo as the TimelineGoal mobile app (Expo + Firebase, branch `sdk54-expo-go`); this web app lives on the `web` branch. Local `main` tracks `origin/web`, so a plain `git push` goes there. A push runs CI and a preview deploy; **only a `v*` tag publishes** (see "Release with GitHub Actions"). |
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
    git push          # to the web branch of TimelineGoal on GitHub; does not deploy
    npx vercel --prod --yes   # builds and publishes to couplegoal-navy.vercel.app

`vercel --prod` prints a unique deployment URL and then `Aliased https://couplegoal-navy.vercel.app`.
The public address updates within a few seconds.

To see a change before publishing it, run `npx vercel` (no `--prod`). That gives a
private preview URL, does not touch the public site, and never runs the cron.

Commit with explicit file paths, never `git add -A`, so a stray local file can never
ride along.

## Release with GitHub Actions

The workflows in `.github/workflows/` do the same thing from GitHub, and they only
live on the `web` branch. There are three files: `verify.yml` holds the check/test/
build recipe, and both of the others call it, so the recipe cannot drift.

| Workflow | Runs on | Does |
| --- | --- | --- |
| `ci.yml` | every push to `web`, every PR aimed at `web` | Verifies. A push also gets a preview URL, printed in the run's summary. Never touches the public site. |
| `release.yml` | pushing a tag matching `v*` | Verifies the tagged commit, builds it with the production environment, publishes, smoke-tests `couplegoal-navy.vercel.app`, then writes the GitHub release notes. |

So an everyday change is still the "Deploy a change" list above minus the last line,
and publishing becomes:

    git tag v0.2.0      # whatever the next version is
    git push --tags     # this is what publishes

Watch it with `gh run watch` or on the Actions tab. The smoke test waits up to a
minute for the alias to answer 200 on `/` and 401 on `/api/keepalive`; if it never
does, the run fails loudly and the previous release keeps serving, because Vercel
only moves the alias after a good deploy. Roll further back with `vercel promote`
as described under "Rolling back".

`npx vercel --prod --yes` from your machine still works and is the fallback whenever
Actions is in the way.

### What the workflows need on GitHub (once)

Three repository secrets:

| Secret | From |
| --- | --- |
| `VERCEL_TOKEN` | vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `orgId` in the git-ignored `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `projectId` in the same file |

The two IDs are not credentials, but this repo is public, so its run logs are too,
and Vercel says not to share the `.vercel` folder. As secrets they come out of the
logs as `***`; as variables they would be printed in full.

**Watch out:** `gh secret set NAME` reads the value from standard input whenever it
has no terminal, so running it from a script or a non-interactive shell quietly
stores an *empty* secret and prints nothing. Set one by piping the value in, then
check the workflow log shows `***` and not a blank:

    pbpaste | tr -d '\n' | gh secret set VERCEL_TOKEN --repo johnnycuongn/TimelineGoal

Secrets are repo-wide, so the mobile branch of this repo can read them too. If any
of the three is missing or empty, both deploy jobs stop on their first step and name
the one that is missing.
No Supabase value is needed here: `vercel build` pulls `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` from the Vercel project itself. A plain
`npm run build`, in CI or anywhere else, compiles but produces a bundle that throws
on first load, which is why only `vercel build` output is ever deployed.

Pushing changes to `.github/workflows/` needs the `workflow` scope on your GitHub
token; `gh auth refresh -s workflow` adds it if a push is rejected.

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
