# Feature: nextjs-supabase-vercel-migration

Locator: `odd/tasks/nextjs-supabase-vercel-migration.md` (repo: CCA-SECTOR-7). Engram mirror: `odd/nextjs-supabase-vercel-migration/tasks`.

## Objective
Convert the ChatGPT Sites app (vinext + Cloudflare Workers + D1) into a plain Next.js App Router app deployable on Vercel, backed by Supabase Postgres (project "Calendario", ref `rkcfsucjsdsfnupatans`) with Supabase Auth.

## Problem / Why
The app only runs on ChatGPT Sites: data lives in D1, and the hosting injected identity headers. On Vercel there would be no database and no auth, so reservation data (names, contacts) would be publicly editable.

## Scope
- Remove vinext/Cloudflare/connector tooling; standard `next dev|build|start`.
- Postgres schema + seeds equivalent to drizzle 0000–0006 (fresh DB: seed accented NEUQUÉN / CUTRAL CÓ directly).
- Atomic overlap-safe reservation create/update as Postgres functions (RPC), race-safe under READ COMMITTED.
- Supabase Auth (email + password), `@supabase/ssr`, `proxy.ts` session refresh, `/login` page, sign-out.
- RLS on all tables: `authenticated` full access (current model: every member edits everything, no roles); `anon` no access.
- Route handlers use the user-session Supabase client (RLS enforced); keep same JSON API contract so the client UI stays unchanged.

- Username + password login (user decision 2026-10-04): `profiles` table (username unique, full_name), synthetic internal email `<username>@users.cca-sector7.app`, admin script `scripts/create-user.mjs` using a local-only secret key.

## Out of scope
- Importing production data from D1 (user confirmed it was test data; not needed).
- Roles/permissions beyond "authenticated = member".
- Vercel deploy itself (separate step after local verification).

## Constraints
- Data access via supabase-js only (no DB password / DATABASE_URL needed).
- Pin new dependency versions; pnpm (user decision) with pnpm-lock.yaml; `allowBuilds: unrs-resolver: false` in pnpm-workspace.yaml.
- Keep UI copy in Spanish (existing project language).
- Public signups must be disabled in the Supabase dashboard (users invited by owner).

## TDD
Mode: off (source: no project/session config; no test runner in project). Functional checks instead.

## Tasks
- [x] T1 Postgres migration file `supabase/migrations/*_init.sql`: tables, indexes, CHECKs, RLS + policies, grants, RPC functions, seeds.
- [x] T2 Apply migration to Supabase project; run security + performance advisors; fix findings.
- [x] T3 Next.js conversion: package.json/scripts/deps, remove Cloudflare/vinext/connector files, Supabase clients, proxy.ts, login/sign-out.
- [x] T4 Port API routes (reservations, reservations/[id], missions, missions/catalog, settings) to supabase-js/RPC with auth checks.
- [ ] T5 Verify: `npm install`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; smoke test with a test user against Supabase (create, overlap 409, series, missions, settings).
- [x] T6 README update for Next.js + Supabase + Vercel env vars.

## Acceptance criteria
- `npm run build` passes with plain Next.js.
- Unauthenticated requests to pages redirect to `/login`; API returns 401.
- Overlapping reservations return 409 with conflicting dates; series insert is all-or-nothing.
- Advisors show no RLS/security errors.

## Progress / Evidence
- Baseline git commit `3757a4f` (original import). `.env.local` created (publishable key, gitignored).
- T1/T3/T4/T6 written by delegated writer. Migrations: `supabase/migrations/20261004000000_init.sql`, `20261004000100_profiles_read_only_for_members.sql` (revokes default write grants on profiles).
- T2: both applied to project via MCP. Security advisors: only `public.rls_auto_enable()` (Supabase-managed event trigger fn, not ours, left as is). Performance: only "unused index" INFO (empty DB).
- T5 partial: tsc OK; `npm run build` OK (re-run by parent); RPC smoke test as `authenticated` in rolled-back tx: series create {count:2}, overlap -> conflicts ["2026-12-06"] and nothing inserted, adjacent slot OK, series update conflict 0 / ok 2, single update conflict 0. anon has no table/RPC privileges. HTTP: `/` -> 307 /login, `/login` 200, unauthenticated API 401.
- `npm run lint` FAILS: 10 errors / 5 warnings, all pre-existing in client UI (react-hooks/set-state-in-effect, exhaustive-deps, no-img-element). Pending user decision.
- Switched to pnpm 12.4.2 (lockfile v9): `pnpm install`, `pnpm exec tsc --noEmit` OK, `pnpm build` OK. Docs updated to pnpm.
- User `lucas.segura` created with scripts/create-user.mjs. E2E (Playwright, prod server): login -> `/`, header shows "Lucas Segura (lucas.segura)"; POST reservation 201, overlap 409 with conflicts, GET month 200, PATCH prepared 200, DELETE 200; settings/catalog (10 places, 9 people)/missions 200. Only console error = expected 409. Test data cleaned (0 reservations).

## Next step
- T5 open only for lint (pre-existing UI errors, user decision).
- Commit; deploy to Vercel with NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
