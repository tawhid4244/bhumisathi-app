# Progress log (handover between sessions)

Update at the end of every task and at the end of every session. Newest entry first.

## Status

| Session | Tasks | State |
| --- | --- | --- |
| 1 | 1–5 | in progress (task 1 done) |
| 2 | 6–10 | not started |
| 3 | 11–15 | not started |
| 4 | 16–20 | not started |

## Golden scenarios

| G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| – | – | – | – | – | – | – | – |

## Entries

### 2026-11-14 22:00 — Session 1, task 2 (schema + synthetic seed)
- Done: Migration `0001_core_schema.sql`: mouzas, dags, owners, khatians (CS/SA/RS/BS), khatian_dags,
  ownership_shares, deeds, bainas, liens, court_cases, khas_flags, land_tax, map_polygons; every table has
  `is_synthetic` default true; CHECK constraints reject real-looking NIDs/phones (only `SYN-0000-0001`,
  `+880-SYN-0001`). pgvector enabled where available. `scripts/seed-data.ts` builds the world
  (seed 2026, mulberry32 PRNG, no clock): 2 mouzas, 60 dags (Nayapara 141–179, Charpara 210–230),
  42 owners, 143 khatians with CS→SA→RS→BS chains (dag numbers shift between surveys), deed 4512/2024,
  khas dag 149 (khas khatian 1), Demo Bank lien L-0003 on 146, civil suit 101/2025 on 142, tax arrears on
  147, RS/BS area mismatch on 148, deceased Abdul Karim on Charpara 210/211. `scripts/seed.ts` runs
  migrations then truncates and inserts in one transaction. `lib/engines/area.ts` (shoelace, map scale).
- Tests: npm run check green: 18 tests (seed twice → identical md5 per table; every row synthetic;
  golden facts; DB rejects a real-looking NID/phone; area maths).
  Row counts: mouzas 2, owners 42, dags 60, khatians 143, khatian_dags 240, ownership_shares 254, deeds 2,
  bainas 1, liens 1, court_cases 2, khas_flags 1, land_tax 73, map_polygons 9.
- Decisions:
  - **Local database without Docker:** this laptop has no Docker/WSL, so local dev and tests use
    PostgreSQL 17 from the npm package `@embedded-postgres/windows-x64` (driven via initdb/pg_ctl in
    `scripts/local-db.ts`, data in `.pgdata/`, localhost only). Server code uses plain SQL through
    `postgres.js` (`lib/sql.ts`) and `DATABASE_URL`; empty = local, Supabase connection string = cloud.
    Migrations are applied by `scripts/migrate.ts` (works on both). Supabase JS stays for Auth/Storage.
  - **Map scaled ×1.1:** the original polygon for dag 145 measured 16.56 dec, which cannot hold Rahim's
    20 dec share in G1. Coordinates in `content/maps/nayapara.json` were multiplied by 1.1, so dag 145 =
    20.04 dec (khatian 20.0). G8 / task 13 now expect ≈20.0 dec. Khatian area = map area (0.1 dec) + offset.
  - Added `land_tax` table (needed for the "tax paid" rule of the Land Crime Prevention Act 2023).
  - About 60 dags: added table-only Nayapara 150–179 to reach 60.
- Known issues: pgvector is not in the local embedded server; task 7 needs a fallback locally.
- Next step: task 3 (share ledger).

### 2026-11-14 21:45 — Session 1, task 1 (scaffold)
- Done: Next.js 16.4.6 (App Router, Turbopack, Cache Components) + TypeScript strict + Tailwind 4;
  fonts Hind Siliguri (Bangla) + IBM Plex Sans, self-hosted by next/font. Vitest 5, Playwright 1.65
  (mobile 375 px + desktop projects), ESLint 9 + Prettier. Scripts: dev, build, check, e2e, seed, eval:ai
  (seed and eval:ai exit 1 with a "not built yet" message until tasks 2 and 10).
  Folder layout from CLAUDE.md. `lib/env.ts` (zod-validated env, errors never print values),
  `lib/db.ts` (anon client + server-only service client), `lib/tools/registry.ts` (defineTool/runTool,
  zod-validated input and output, read/write kinds). Bangla home page "ভূমিসাথী — এক জমি, এক সত্য"
  with links to /check, /chat, /warish, /map, /registry (placeholder pages naming the task that builds them).
  Security headers on every response (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, COOP,
  Permissions-Policy with microphone=self, CSP frame-ancestors/object-src/base-uri/form-action;
  no X-Powered-By). Supabase CLI 3.1.0 installed as a dev dependency (`npx supabase`).
- Tests: npm run check green (typecheck, lint, 7 unit tests). npm run build green (all pages static).
  npm run e2e green: 16/16 (home + 5 links + no horizontal scroll + security headers, mobile and desktop).
- Decisions: Kept create-next-app defaults for Next 16 (Cache Components on). Strict nonce-based script CSP
  is deferred to task 16 because it needs per-request rendering. `typecheck` runs `next typegen` first so
  Next's generated route types exist on a fresh clone. `.gitattributes` forces LF line endings.
  GitHub repo tawhid4244/bhumisathi-app created PRIVATE; switch to public before submission.
- Known issues: `npm audit` reports 7 moderate issues in the ESLint/typescript-eslint dev toolchain only
  (not shipped to users); left as is. All .env.local values are still empty.
- Next step: fill the three Supabase values in .env.local, run `npx supabase login` and
  `npx supabase link --project-ref <ref>`, then task 2 (schema + deterministic seed).

<!-- Template:
### YYYY-MM-DD HH:MM — Session N, task #
- Done:
- Tests: npm run check (green/red), e2e (which G pass)
- Decisions:
- Known issues:
- Next step:
-->
