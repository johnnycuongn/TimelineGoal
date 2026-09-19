# CoupleGoal

Vite + React SPA on Supabase and Vercel. Node 22 (`nvm use`), npm. `npm run fix && npm run check && npm test` before every commit.

- Domain types in `src/lib/domain.ts`; rows are mapped once in `src/data/mappers.ts`. Pure maths (`periods`, `ladder`, `mood`, `views`) never import Supabase.
- One fetch per couple (`fetchCoupleData`), kept fresh by Realtime + SWR in `src/data/use-couple-data.ts`. Pages derive `denView` / `timelineView` from it.
- Every write is a function in `src/data/mutations.ts` (goal writes in `src/data/goal-mutations.ts`); errors are already user-facing copy (raised by triggers/RPCs in `supabase/migrations/`).
- Rule 0: never read `.env.local`; never add a `sb_secret_` key anywhere. Rule 1: mobile-first, verify at 320/375/768/1280 before claiming a screen works. Rule 2: publishing is the owner's call — ask before `vercel --prod`, use `vercel deploy --target=preview` to check a build, and remember that the *first* deployment of a fresh Vercel project is promoted to production by the CLI whatever you asked for.
- UI primitives in `src/components/ui/` are ours (hand-written Radix wrappers); tokens live in `src/styles.css` only.
- The pup (`src/components/pup/`) is lazy-loaded; never import `pup-stage` or `pup-model` outside that folder. `noUnknownAttribute` is off there for R3F props.
